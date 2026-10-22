import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load environment variables from possible locations
const rootEnvPath = path.resolve(process.cwd(), ".env");
const localEnvPath = path.resolve(process.cwd(), ".env.local");
const webLocalEnvPath = path.resolve(process.cwd(), "apps/web/.env.local");
const webEnvPath = path.resolve(process.cwd(), "apps/web/.env");
const repoRootEnvPath = path.resolve(__dirname, "../../../.env");
const repoWebEnvPath = path.resolve(__dirname, "../../../apps/web/.env.local");

[repoRootEnvPath, repoWebEnvPath, rootEnvPath, localEnvPath, webLocalEnvPath, webEnvPath].forEach((envFile) => {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
  }
});

interface MenuCsvRow {
  Category: string;
  Subcategory: string;
  "Item Name": string;
  "Menu Description": string;
  "Core Ingredients": string;
  "Shared Pre-Prep / Components": string;
  "Primary Equipment": string;
  "Serving Ware": string;
  "Target Price ₹": string;
  "Trial Ceiling ₹": string;
  Availability: string;
  "Best Pairing": string;
  "Chai ke Saathi": string;
  Dietary: string;
  "Protein Focus": string;
  Spice: string;
  "Menu Status": string;
  "Actual Portion Cost ₹": string;
  "Food Cost %": string;
  "Trial Status": string;
  Notes: string;
}

interface ParsedMenuItem {
  categoryName: string;
  categorySortOrder: number;
  name: string;
  description: string;
  status: "ACTIVE" | "SCHEDULED" | "AVAILABLE";
  pricePaise: number;
  metadata: {
    dietary: string;
    protein_focus: string;
    spice: string;
    best_pairing: string;
    chai_ke_saathi: boolean;
    subcategory: string;
    availability: string;
    core_ingredients: string;
    primary_equipment: string;
    serving_ware: string;
    notes: string;
  };
}

function parsePriceToPaise(rawPrice: string): number {
  if (!rawPrice) return 0;
  const cleaned = rawPrice.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100);
}

function mapMenuStatus(rawStatus: string): "ACTIVE" | "SCHEDULED" | "AVAILABLE" {
  const status = (rawStatus || "").trim().toLowerCase();
  if (status === "core" || status === "combo") return "ACTIVE";
  if (status === "seasonal") return "SCHEDULED";
  return "AVAILABLE";
}

async function runSeed() {
  const isApply = process.argv.includes("--apply");
  const csvPath = path.resolve(__dirname, "../seed/menu-seed-master.csv");

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV seed file not found at: ${csvPath}`);
    process.exit(1);
  }

  console.log(`\n📂 Reading menu seed file: ${csvPath}`);
  const csvContent = fs.readFileSync(csvPath, "utf-8");

  const rawRecords: MenuCsvRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`📋 Found ${rawRecords.length} raw rows in CSV.`);

  // 1. Group & preserve category order
  const categoriesMap = new Map<string, number>();
  const parsedItems: ParsedMenuItem[] = [];

  for (const row of rawRecords) {
    const categoryName = (row.Category || "Uncategorized").trim();
    if (!categoriesMap.has(categoryName)) {
      categoriesMap.set(categoryName, categoriesMap.size);
    }

    const sortOrder = categoriesMap.get(categoryName)!;
    const pricePaise = parsePriceToPaise(row["Target Price ₹"]);
    const status = mapMenuStatus(row["Menu Status"]);
    const isChaiKeSaathi = (row["Chai ke Saathi"] || "").trim().toLowerCase() === "yes";

    parsedItems.push({
      categoryName,
      categorySortOrder: sortOrder,
      name: (row["Item Name"] || "").trim(),
      description: (row["Menu Description"] || "").trim(),
      status,
      pricePaise,
      metadata: {
        dietary: (row.Dietary || "").trim(),
        protein_focus: (row["Protein Focus"] || "").trim(),
        spice: (row.Spice || "").trim(),
        best_pairing: (row["Best Pairing"] || "").trim(),
        chai_ke_saathi: isChaiKeSaathi,
        subcategory: (row.Subcategory || "").trim(),
        availability: (row.Availability || "").trim(),
        core_ingredients: (row["Core Ingredients"] || "").trim(),
        primary_equipment: (row["Primary Equipment"] || "").trim(),
        serving_ware: (row["Serving Ware"] || "").trim(),
        notes: (row.Notes || "").trim(),
      },
    });
  }

  // Summary
  console.log(`\n=============================================================`);
  console.log(`📊 SEED PARSE SUMMARY (${isApply ? "🚀 APPLY MODE" : "🔍 DRY RUN MODE"})`);
  console.log(`=============================================================`);
  console.log(`Unique Categories (${categoriesMap.size}):`);
  for (const [catName, order] of categoriesMap.entries()) {
    const count = parsedItems.filter((item) => item.categoryName === catName).length;
    console.log(`  [${order}] ${catName} — (${count} items)`);
  }
  console.log(`\nTotal Items Parsed: ${parsedItems.length}`);

  // Sample Preview
  console.log(`\n🔎 Sample Item Preview (First 3 items):`);
  parsedItems.slice(0, 3).forEach((item, idx) => {
    console.log(`\n  #${idx + 1}: ${item.name}`);
    console.log(`      Category: ${item.categoryName} (Sort Order: ${item.categorySortOrder})`);
    console.log(`      Status: ${item.status}`);
    console.log(`      Price: ₹${item.pricePaise / 100} (${item.pricePaise} paise)`);
    console.log(`      Description: "${item.description}"`);
    console.log(`      Metadata:`, JSON.stringify(item.metadata, null, 2));
  });

  if (!isApply) {
    console.log(`\n=============================================================`);
    console.log(`✅ DRY RUN COMPLETE: 0 database writes performed.`);
    console.log(`👉 To write to Supabase, run with the --apply flag:`);
    console.log(`   npm run db:seed:apply`);
    console.log(`=============================================================\n`);
    return;
  }

  // Apply Mode
  console.log(`\n🚀 Applying seed to Supabase...`);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      `❌ Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.`
    );
    console.error(`   Please set these in your .env or .env.local file to apply the seed.`);
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // 1. Get or Create Default Location
  console.log(`📍 Resolving default location...`);
  let locationId: string;
  let { data: existingLocation, error: locFindError } = await supabase
    .from("locations")
    .select("id, name")
    .limit(1)
    .maybeSingle();

  if (locFindError) {
    console.error(`❌ Failed to query locations:`, locFindError.message);
    process.exit(1);
  }

  if (existingLocation) {
    locationId = existingLocation.id;
    console.log(`   Found existing location (${existingLocation.name}) ID: ${locationId}`);
  } else {
    const { data: newLoc, error: locInsertError } = await supabase
      .from("locations")
      .insert({
        name: "Rishikesh Main",
        timezone: "Asia/Kolkata",
      })
      .select("id")
      .single();

    if (locInsertError || !newLoc) {
      console.error(`❌ Failed to create location:`, locInsertError?.message);
      process.exit(1);
    }
    locationId = newLoc.id;
    console.log(`   Created new location ID: ${locationId}`);
  }

  // 2. Upsert Categories
  console.log(`\n📁 Upserting ${categoriesMap.size} menu categories...`);
  const categoryIdMap = new Map<string, string>();

  for (const [catName, sortOrder] of categoriesMap.entries()) {
    const { data: existingCat } = await supabase
      .from("menu_categories")
      .select("id")
      .eq("location_id", locationId)
      .eq("name", catName)
      .maybeSingle();

    if (existingCat) {
      categoryIdMap.set(catName, existingCat.id);
      // update sort order if changed
      await supabase
        .from("menu_categories")
        .update({ sort_order: sortOrder })
        .eq("id", existingCat.id);
    } else {
      const { data: insertedCat, error: catErr } = await supabase
        .from("menu_categories")
        .insert({
          location_id: locationId,
          name: catName,
          sort_order: sortOrder,
        })
        .select("id")
        .single();

      if (catErr || !insertedCat) {
        console.error(`❌ Failed to insert category "${catName}":`, catErr?.message);
        continue;
      }
      categoryIdMap.set(catName, insertedCat.id);
    }
  }

  // 3. Upsert Menu Items & Snapshot Versions/Prices
  console.log(`\n🍽️  Upserting ${parsedItems.length} menu items...`);
  let insertedCount = 0;
  let updatedCount = 0;

  for (const item of parsedItems) {
    const categoryId = categoryIdMap.get(item.categoryName);
    if (!categoryId) {
      console.warn(`⚠️  Category ID not found for "${item.categoryName}", skipping "${item.name}"`);
      continue;
    }

    const { data: existingItem } = await supabase
      .from("menu_items")
      .select("id")
      .eq("category_id", categoryId)
      .eq("name", item.name)
      .maybeSingle();

    let itemId: string;

    if (existingItem) {
      itemId = existingItem.id;
      await supabase
        .from("menu_items")
        .update({
          status: item.status,
          metadata: item.metadata,
        })
        .eq("id", itemId);
      updatedCount++;
    } else {
      const { data: newItem, error: itemErr } = await supabase
        .from("menu_items")
        .insert({
          category_id: categoryId,
          name: item.name,
          status: item.status,
          metadata: item.metadata,
        })
        .select("id")
        .single();

      if (itemErr || !newItem) {
        console.error(`❌ Failed to insert menu item "${item.name}":`, itemErr?.message);
        continue;
      }
      itemId = newItem.id;
      insertedCount++;
    }

    // Insert version record
    await supabase.from("menu_item_versions").insert({
      menu_item_id: itemId,
      description: item.description,
      image_url: null,
      metadata: item.metadata,
    });

    // Upsert or insert effective price
    await supabase.from("menu_prices").insert({
      menu_item_id: itemId,
      amount_paise: item.pricePaise,
      currency: "INR",
      effective_from: new Date().toISOString(),
      effective_to: null,
    });
  }

  console.log(`\n=============================================================`);
  console.log(`🎉 SEED APPLIED SUCCESSFULLY`);
  console.log(`   - New Items Inserted: ${insertedCount}`);
  console.log(`   - Existing Items Updated: ${updatedCount}`);
  console.log(`   - Categories: ${categoryIdMap.size}`);
  console.log(`=============================================================\n`);
}

runSeed().catch((err) => {
  console.error("❌ Seed script error:", err);
  process.exit(1);
});
