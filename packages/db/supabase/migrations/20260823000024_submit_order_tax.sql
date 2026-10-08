-- ==============================================================================
-- Smol Café — Migration 20260823000024: Calculate 5% Restaurant GST in submit_order
-- Ensures database transaction calculates 5% GST (2.5% CGST + 2.5% SGST)
-- ==============================================================================

CREATE OR REPLACE FUNCTION submit_order(
  p_location_id UUID,
  p_table_session_id UUID,
  p_idempotency_key TEXT,
  p_items JSONB, -- Array of { menu_item_id, expected_unit_price_paise, qty }
  p_reward_id UUID DEFAULT NULL,
  p_profile_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_session_status table_session_status;
  v_existing_order orders%ROWTYPE;
  v_order_no INTEGER;
  v_order_id UUID;
  v_item JSONB;
  v_menu_item_id UUID;
  v_expected_price INTEGER;
  v_current_price INTEGER;
  v_item_name TEXT;
  v_version_id UUID;
  v_qty INTEGER;
  v_servable INTEGER;
  v_line_subtotal INTEGER;
  v_subtotal_paise INTEGER := 0;
  v_discount_paise INTEGER := 0;
  v_tax_paise INTEGER := 0;
  v_total_paise INTEGER := 0;
  v_price_conflicts JSONB := '[]'::jsonb;
  v_stock_conflicts JSONB := '[]'::jsonb;
  v_recipe_id UUID;
  v_comp RECORD;
  v_reward rewards%ROWTYPE;
  v_user_balance INTEGER := 0;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Check Idempotency (Prevent double-taps)
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key != '' THEN
    SELECT * INTO v_existing_order FROM orders WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'is_duplicate', true,
        'order_id', v_existing_order.id,
        'order_no', v_existing_order.order_no,
        'discount_paise', v_existing_order.discount_snapshot,
        'tax_paise', v_existing_order.tax_snapshot,
        'total_paise', v_existing_order.total_snapshot
      );
    END IF;
  END IF;

  -- 2. Verify Table Session is OPEN
  SELECT status INTO v_session_status 
  FROM table_sessions 
  WHERE id = p_table_session_id AND location_id = p_location_id;

  IF NOT FOUND OR v_session_status != 'OPEN' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SESSION_NOT_OPEN',
      'message', 'Your table session is no longer active. Please scan the QR code again.'
    );
  END IF;

  -- 3. Re-validate Current Prices & Servable Stock Quantities
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_menu_item_id := (v_item->>'menu_item_id')::UUID;
    v_expected_price := (v_item->>'expected_unit_price_paise')::INTEGER;
    v_qty := (v_item->>'qty')::INTEGER;

    -- Fetch item name and latest version
    SELECT mi.name, mv.id INTO v_item_name, v_version_id
    FROM menu_items mi
    LEFT JOIN menu_item_versions mv ON mv.menu_item_id = mi.id
    WHERE mi.id = v_menu_item_id
    ORDER BY mv.created_at DESC
    LIMIT 1;

    -- Check Servable Quantity
    v_servable := servable_qty(v_menu_item_id);
    IF v_servable < v_qty THEN
      v_stock_conflicts := v_stock_conflicts || jsonb_build_object(
        'menu_item_id', v_menu_item_id,
        'name', COALESCE(v_item_name, 'Item'),
        'requested_qty', v_qty,
        'servable_qty', v_servable
      );
    END IF;

    -- Fetch current effective price
    SELECT amount_paise INTO v_current_price
    FROM menu_prices
    WHERE menu_item_id = v_menu_item_id
      AND effective_from <= v_now
      AND (effective_to IS NULL OR effective_to > v_now)
    ORDER BY effective_from DESC
    LIMIT 1;

    -- Price Mismatch Check
    IF v_current_price IS NOT NULL AND v_current_price != v_expected_price THEN
      v_price_conflicts := v_price_conflicts || jsonb_build_object(
        'menu_item_id', v_menu_item_id,
        'name', COALESCE(v_item_name, 'Item'),
        'expected_price_paise', v_expected_price,
        'current_price_paise', v_current_price
      );
    END IF;

    v_line_subtotal := COALESCE(v_current_price, v_expected_price) * v_qty;
    v_subtotal_paise := v_subtotal_paise + v_line_subtotal;
  END LOOP;

  -- If any conflicts detected, return them without mutating database state
  IF jsonb_array_length(v_stock_conflicts) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_STOCK',
      'message', 'Some items are no longer available in the requested quantity.',
      'stock_conflicts', v_stock_conflicts
    );
  END IF;

  IF jsonb_array_length(v_price_conflicts) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PRICE_CHANGED',
      'message', 'Some item prices have changed. Please review your cart.',
      'changed_items', v_price_conflicts
    );
  END IF;

  -- 4. Validate & Apply Patron Loyalty Reward
  IF p_reward_id IS NOT NULL THEN
    SELECT * INTO v_reward FROM rewards WHERE id = p_reward_id AND is_active = true;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_REWARD',
        'message', 'The selected reward offer is no longer valid.'
      );
    END IF;

    IF p_profile_id IS NOT NULL THEN
      SELECT COALESCE(current_balance, 0) INTO v_user_balance
      FROM loyalty_accounts
      WHERE profile_id = p_profile_id;

      IF v_user_balance < v_reward.points_cost THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'INSUFFICIENT_POINTS',
          'message', 'You do not have enough Smol Club points for this reward.'
        );
      END IF;
    END IF;

    -- Calculate Discount Amount
    IF v_reward.type = 'PERCENTAGE' THEN
      v_discount_paise := FLOOR(v_subtotal_paise * v_reward.discount_value / 100);
    ELSIF v_reward.type = 'FIXED_VALUE' THEN
      v_discount_paise := LEAST(v_subtotal_paise, v_reward.discount_value);
    ELSIF v_reward.type = 'FIXED_ITEM' THEN
      v_discount_paise := LEAST(v_subtotal_paise, v_reward.discount_value);
    END IF;
  END IF;

  -- 5. Calculate Final Financial Totals (5% Restaurant GST: 2.5% CGST + 2.5% SGST)
  v_tax_paise := ROUND((v_subtotal_paise - v_discount_paise) * 0.05);
  v_total_paise := GREATEST(0, (v_subtotal_paise - v_discount_paise) + v_tax_paise);

  -- 6. Generate Next Sequential Order Number
  SELECT COALESCE(MAX(order_no), 0) + 1 INTO v_order_no 
  FROM orders 
  WHERE location_id = p_location_id;

  -- 7. Insert Order Record
  INSERT INTO orders (
    location_id,
    table_session_id,
    customer_id,
    order_no,
    status,
    service_mode,
    submitted_at,
    subtotal_snapshot,
    discount_snapshot,
    tax_snapshot,
    total_snapshot,
    idempotency_key,
    version
  ) VALUES (
    p_location_id,
    p_table_session_id,
    p_profile_id,
    v_order_no,
    'SUBMITTED',
    'DINE_IN',
    v_now,
    v_subtotal_paise,
    v_discount_paise,
    v_tax_paise,
    v_total_paise,
    p_idempotency_key,
    1
  ) RETURNING id INTO v_order_id;

  -- 8. Debit Points & Record Reward Redemption in the SAME Transaction
  IF p_reward_id IS NOT NULL AND v_discount_paise > 0 THEN
    -- Debit loyalty ledger
    PERFORM record_loyalty_movement(
      p_profile_id,
      -v_reward.points_cost,
      'REDEMPTION',
      v_order_id,
      'Redeemed for: ' || v_reward.title
    );

    -- Log reward redemption audit
    INSERT INTO reward_redemptions (
      reward_id,
      profile_id,
      order_id,
      points_spent,
      discount_applied_paise,
      created_at
    ) VALUES (
      v_reward.id,
      p_profile_id,
      v_order_id,
      v_reward.points_cost,
      v_discount_paise,
      v_now
    );
  END IF;

  -- 9. Insert Order Items & Atomically Decrement Inventory Ingredients
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_menu_item_id := (v_item->>'menu_item_id')::UUID;
    v_qty := (v_item->>'qty')::INTEGER;

    -- Fetch current price and latest version ID
    SELECT amount_paise INTO v_current_price
    FROM menu_prices
    WHERE menu_item_id = v_menu_item_id
      AND effective_from <= v_now
      AND (effective_to IS NULL OR effective_to > v_now)
    ORDER BY effective_from DESC
    LIMIT 1;

    SELECT mv.id INTO v_version_id
    FROM menu_item_versions mv
    WHERE mv.menu_item_id = v_menu_item_id
    ORDER BY mv.created_at DESC
    LIMIT 1;

    v_line_subtotal := COALESCE(v_current_price, (v_item->>'expected_unit_price_paise')::INTEGER) * v_qty;

    INSERT INTO order_items (
      order_id,
      menu_item_id,
      menu_item_version_id,
      quantity,
      unit_price,
      line_subtotal,
      notes
    ) VALUES (
      v_order_id,
      v_menu_item_id,
      v_version_id,
      v_qty,
      COALESCE(v_current_price, (v_item->>'expected_unit_price_paise')::INTEGER),
      v_line_subtotal,
      v_item->>'notes'
    );

    -- Deduct Ingredient Stocks
    SELECT id INTO v_recipe_id FROM recipes WHERE menu_item_id = v_menu_item_id;
    IF v_recipe_id IS NOT NULL THEN
      FOR v_comp IN 
        SELECT ingredient_id, quantity 
        FROM recipe_components 
        WHERE recipe_id = v_recipe_id
      LOOP
        UPDATE ingredients 
        SET current_stock = current_stock - (v_comp.quantity * v_qty),
            updated_at = v_now
        WHERE id = v_comp.ingredient_id;

        INSERT INTO stock_movements (
          ingredient_id,
          movement_type,
          quantity,
          reference_order_id,
          created_at
        ) VALUES (
          v_comp.ingredient_id,
          'ORDER_CONSUMED',
          -(v_comp.quantity * v_qty),
          v_order_id,
          v_now
        );
      END LOOP;
    END IF;
  END LOOP;

  -- 10. Audit Log Order Creation Event
  INSERT INTO order_audit_events (
    order_id,
    from_status,
    to_status,
    actor_type,
    created_at
  ) VALUES (
    v_order_id,
    'DRAFT',
    'SUBMITTED',
    'CUSTOMER',
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_no', v_order_no,
    'subtotal_paise', v_subtotal_paise,
    'discount_paise', v_discount_paise,
    'tax_paise', v_tax_paise,
    'total_paise', v_total_paise
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
