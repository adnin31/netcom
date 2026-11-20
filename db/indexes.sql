-- Indexes are created after the bulk load (COPY is faster without them).
CREATE INDEX IF NOT EXISTS idx_orders_purchase_ts ON orders (order_purchase_timestamp);
CREATE INDEX IF NOT EXISTS idx_orders_customer    ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders (order_status);
-- Partial index that serves the "not yet shipped" page directly.
CREATE INDEX IF NOT EXISTS idx_orders_unshipped   ON orders (order_purchase_timestamp DESC)
  WHERE order_delivered_carrier_date IS NULL AND order_status NOT IN ('canceled', 'unavailable', 'delivered');
CREATE INDEX IF NOT EXISTS idx_items_product      ON order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_items_seller       ON order_items (seller_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order      ON order_reviews (order_id);
CREATE INDEX IF NOT EXISTS idx_customers_unique   ON customers (customer_unique_id);
CREATE INDEX IF NOT EXISTS idx_customers_zip      ON customers (customer_zip_code_prefix);
CREATE INDEX IF NOT EXISTS idx_sellers_zip        ON sellers (seller_zip_code_prefix);
CREATE INDEX IF NOT EXISTS idx_geolocation_zip    ON geolocation (geolocation_zip_code_prefix);
CREATE INDEX IF NOT EXISTS idx_products_category  ON products (product_category_name);
ANALYZE;
