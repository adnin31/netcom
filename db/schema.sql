-- =============================================================
-- NETCOM Technical Test - schema (PostgreSQL 16)
-- Dataset: Olist Brazilian E-Commerce (9 CSV files)
-- Column names follow the original CSV headers (incl. "lenght").
-- =============================================================

CREATE TABLE IF NOT EXISTS product_category_name_translation (
  product_category_name          varchar(80) PRIMARY KEY,
  product_category_name_english  varchar(80) NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  customer_id               varchar(32) PRIMARY KEY,
  customer_unique_id        varchar(32) NOT NULL,
  customer_zip_code_prefix  varchar(5)  NOT NULL,
  customer_city             varchar(80) NOT NULL,
  customer_state            char(2)     NOT NULL
);

CREATE TABLE IF NOT EXISTS sellers (
  seller_id               varchar(32) PRIMARY KEY,
  seller_zip_code_prefix  varchar(5)  NOT NULL,
  seller_city             varchar(80) NOT NULL,
  seller_state            char(2)     NOT NULL
);

-- No natural key in the CSV (zip prefixes repeat), so a surrogate id is added.
CREATE TABLE IF NOT EXISTS geolocation (
  id                           bigserial PRIMARY KEY,
  geolocation_zip_code_prefix  varchar(5)  NOT NULL,
  geolocation_lat              double precision NOT NULL,
  geolocation_lng              double precision NOT NULL,
  geolocation_city             varchar(80) NOT NULL,
  geolocation_state            char(2)     NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  product_id                  varchar(32) PRIMARY KEY,
  product_category_name       varchar(80) REFERENCES product_category_name_translation (product_category_name)
                              ON UPDATE CASCADE ON DELETE SET NULL,
  product_name_lenght         integer,
  product_description_lenght  integer,
  product_photos_qty          integer,
  product_weight_g            integer,
  product_length_cm           integer,
  product_height_cm           integer,
  product_width_cm            integer
);

CREATE TABLE IF NOT EXISTS orders (
  order_id                       varchar(32) PRIMARY KEY,
  customer_id                    varchar(32) NOT NULL REFERENCES customers (customer_id) ON DELETE RESTRICT,
  order_status                   varchar(20) NOT NULL,
  order_purchase_timestamp       timestamp   NOT NULL,
  order_approved_at              timestamp,
  order_delivered_carrier_date   timestamp,
  order_delivered_customer_date  timestamp,
  order_estimated_delivery_date  timestamp
);

CREATE TABLE IF NOT EXISTS order_items (
  order_id             varchar(32) NOT NULL REFERENCES orders (order_id) ON DELETE CASCADE,
  order_item_id        smallint    NOT NULL,
  product_id           varchar(32) NOT NULL REFERENCES products (product_id) ON DELETE RESTRICT,
  seller_id            varchar(32) NOT NULL REFERENCES sellers (seller_id) ON DELETE RESTRICT,
  shipping_limit_date  timestamp   NOT NULL,
  price                numeric(12,2) NOT NULL CHECK (price >= 0),
  freight_value        numeric(12,2) NOT NULL CHECK (freight_value >= 0),
  PRIMARY KEY (order_id, order_item_id)
);

CREATE TABLE IF NOT EXISTS order_payments (
  order_id              varchar(32) NOT NULL REFERENCES orders (order_id) ON DELETE CASCADE,
  payment_sequential    smallint    NOT NULL,
  payment_type          varchar(20) NOT NULL,
  payment_installments  smallint    NOT NULL,
  payment_value         numeric(12,2) NOT NULL CHECK (payment_value >= 0),
  PRIMARY KEY (order_id, payment_sequential)
);

-- review_id is NOT unique in the dataset (one review can cover several orders),
-- so the key is (review_id, order_id).
CREATE TABLE IF NOT EXISTS order_reviews (
  review_id                varchar(32) NOT NULL,
  order_id                 varchar(32) NOT NULL REFERENCES orders (order_id) ON DELETE CASCADE,
  review_score             smallint    NOT NULL CHECK (review_score BETWEEN 1 AND 5),
  review_comment_title     text,
  review_comment_message   text,
  review_creation_date     timestamp,
  review_answer_timestamp  timestamp,
  PRIMARY KEY (review_id, order_id)
);

-- Application users (dashboard login)
CREATE TABLE IF NOT EXISTS app_users (
  id             serial PRIMARY KEY,
  name           varchar(100) NOT NULL,
  email          varchar(150) NOT NULL UNIQUE,
  password_hash  varchar(100) NOT NULL,
  role           varchar(20)  NOT NULL DEFAULT 'admin',
  created_at     timestamptz  NOT NULL DEFAULT now()
);
