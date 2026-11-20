#!/usr/bin/env bash
# Load the Olist CSV dataset into PostgreSQL and seed the admin user.
# Usage: DATABASE_URL=postgres://user:pass@host:port/db ./scripts/import-dataset.sh /path/to/csv-folder
set -euo pipefail

DIR="${1:?usage: import-dataset.sh <folder with olist_*.csv>}"
URL="${DATABASE_URL:?DATABASE_URL is required}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PSQL=(psql "$URL" -v ON_ERROR_STOP=1 -q)

echo "-> schema"
"${PSQL[@]}" -f "$ROOT/db/schema.sql"

"${PSQL[@]}" -c "TRUNCATE order_reviews, order_payments, order_items, orders, products, geolocation, sellers, customers, product_category_name_translation RESTART IDENTITY CASCADE"

load() { # table csv-file column-list
  echo "-> $1"
  "${PSQL[@]}" -c "\\copy $1 ($3) FROM '$DIR/$2' WITH (FORMAT csv, HEADER true)"
}

load product_category_name_translation product_category_name_translation.csv \
  "product_category_name, product_category_name_english"

# Two categories used by products are missing from the translation file;
# register them (english = original name) so the foreign key holds.
echo "-> products (via staging table)"
"${PSQL[@]}" <<SQL
CREATE TEMP TABLE stg_products AS SELECT * FROM products WITH NO DATA;
\\copy stg_products FROM '$DIR/olist_products_dataset.csv' WITH (FORMAT csv, HEADER true)
INSERT INTO product_category_name_translation
  SELECT DISTINCT product_category_name, product_category_name FROM stg_products
  WHERE product_category_name IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO products SELECT * FROM stg_products;
SQL

load customers olist_customers_dataset.csv \
  "customer_id, customer_unique_id, customer_zip_code_prefix, customer_city, customer_state"
load sellers olist_sellers_dataset.csv \
  "seller_id, seller_zip_code_prefix, seller_city, seller_state"
load geolocation olist_geolocation_dataset.csv \
  "geolocation_zip_code_prefix, geolocation_lat, geolocation_lng, geolocation_city, geolocation_state"
load orders olist_orders_dataset.csv \
  "order_id, customer_id, order_status, order_purchase_timestamp, order_approved_at, order_delivered_carrier_date, order_delivered_customer_date, order_estimated_delivery_date"
load order_items olist_order_items_dataset.csv \
  "order_id, order_item_id, product_id, seller_id, shipping_limit_date, price, freight_value"
load order_payments olist_order_payments_dataset.csv \
  "order_id, payment_sequential, payment_type, payment_installments, payment_value"
load order_reviews olist_order_reviews_dataset.csv \
  "review_id, order_id, review_score, review_comment_title, review_comment_message, review_creation_date, review_answer_timestamp"

echo "-> indexes"
"${PSQL[@]}" -f "$ROOT/db/indexes.sql"

echo "-> admin user (admin@netcom.local / admin123)"
"${PSQL[@]}" <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO app_users (name, email, password_hash, role)
VALUES ('Administrator', 'admin@netcom.local', crypt('admin123', gen_salt('bf', 10)), 'admin')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
DROP EXTENSION pgcrypto;
SQL

psql "$URL" -c "
SELECT 'categories' AS table_name, count(*) FROM product_category_name_translation
UNION ALL SELECT 'customers', count(*) FROM customers
UNION ALL SELECT 'sellers', count(*) FROM sellers
UNION ALL SELECT 'geolocation', count(*) FROM geolocation
UNION ALL SELECT 'products', count(*) FROM products
UNION ALL SELECT 'orders', count(*) FROM orders
UNION ALL SELECT 'order_items', count(*) FROM order_items
UNION ALL SELECT 'order_payments', count(*) FROM order_payments
UNION ALL SELECT 'order_reviews', count(*) FROM order_reviews"
echo "done."
