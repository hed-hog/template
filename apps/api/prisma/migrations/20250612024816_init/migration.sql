-- CreateEnum
CREATE TYPE "chat_message_type_enum" AS ENUM ('text', 'image', 'video', 'audio', 'file');

-- CreateEnum
CREATE TYPE "chat_person_role_enum" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "instance_visibility_enum" AS ENUM ('public', 'private', 'unlisted');

-- CreateEnum
CREATE TYPE "route_method_enum" AS ENUM ('GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS', 'HEAD');

-- CreateEnum
CREATE TYPE "setting_type_enum" AS ENUM ('string', 'array', 'number', 'boolean', 'json');

-- CreateEnum
CREATE TYPE "subscription_person_role_enum" AS ENUM ('admin', 'user');

-- CreateEnum
CREATE TYPE "subscription_plan_duration_enum" AS ENUM ('monthly', 'yearly', 'quarterly', 'semianually');

-- CreateEnum
CREATE TYPE "subscription_status_enum" AS ENUM ('active', 'expired', 'canceled');

-- CreateEnum
CREATE TYPE "wallet_transaction_type_enum" AS ENUM ('deposit', 'withdraw');

-- CreateTable
CREATE TABLE "category" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "category_id" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_9c4e4a89e3674fc9f382d733f03" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_locale" (
    "category_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "name" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_e56abeb6623877833eb81839ab4" PRIMARY KEY ("category_id","locale_id")
);

-- CreateTable
CREATE TABLE "chat" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_9d0b2ba74336710fd31154738a5" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message" (
    "id" SERIAL NOT NULL,
    "chat_id" INTEGER NOT NULL,
    "person_id" INTEGER NOT NULL,
    "type" "chat_message_type_enum" NOT NULL,
    "content" VARCHAR(2047) NOT NULL,
    "read_at" TIMESTAMP(6),
    "received_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_3cc0d85193aade457d3077dd06b" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_person" (
    "id" SERIAL NOT NULL,
    "chat_id" INTEGER NOT NULL,
    "person_id" INTEGER NOT NULL,
    "role" "chat_person_role_enum" NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_3fd3aba7cff0efd62440b687fe5" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component" (
    "id" SERIAL NOT NULL,
    "type_id" INTEGER NOT NULL,
    "name" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_c084eba2d3b157314de79135f09" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_prop" (
    "id" SERIAL NOT NULL,
    "type_id" INTEGER NOT NULL,
    "component_id" INTEGER NOT NULL,
    "name" VARCHAR NOT NULL,
    "default" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_44b20cb5fa872980fb3eef05bfd" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_prop_type" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_4fd25da5ccf98c6a24001056cd8" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_prop_type_locale" (
    "id" SERIAL NOT NULL,
    "type_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "name" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_3cd28d33b9b72ea048e1a8f5e86" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_type" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_342675811724f592a8f57a6c6b9" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_type_locale" (
    "id" SERIAL NOT NULL,
    "type_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "name" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_a2393b6d58cb813703eddc9093c" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_us" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR NOT NULL,
    "email" VARCHAR NOT NULL,
    "message" VARCHAR(1024) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_b61766a4d93470109266b976cfe" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_6a2083913f3647b44f205204e36" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_locale" (
    "content_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "title" VARCHAR NOT NULL,
    "body" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_f0667e1e53b5ccd7d00fc66b2b4" PRIMARY KEY ("content_id","locale_id")
);

-- CreateTable
CREATE TABLE "country" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_bf6e37c231c4f4ea56dcd887269" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "country_locale" (
    "country_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "name" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_df7141e9042d27d998b49a9b325" PRIMARY KEY ("country_id","locale_id")
);

-- CreateTable
CREATE TABLE "dashboard" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_233ed28fa3a1f9fbe743f571f75" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_component" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "min_width" INTEGER NOT NULL DEFAULT 1,
    "max_width" INTEGER,
    "min_height" INTEGER NOT NULL DEFAULT 1,
    "max_height" INTEGER,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "is_resizable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_0db8e7613dacbccf226113cb128" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_component_locale" (
    "component_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_4c64473f04145378896f0e2bd50" PRIMARY KEY ("component_id","locale_id")
);

-- CreateTable
CREATE TABLE "dashboard_item" (
    "id" SERIAL NOT NULL,
    "component_id" INTEGER NOT NULL,
    "dashboard_id" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "x_axis" INTEGER NOT NULL,
    "y_axis" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_4ad9d196b68ca545a9a52535ed1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_locale" (
    "dashboard_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_c345a8463f40f6d7b9aa585d06e" PRIMARY KEY ("dashboard_id","locale_id")
);

-- CreateTable
CREATE TABLE "dashboard_user" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "x_axis" INTEGER NOT NULL,
    "y_axis" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_450acb76f1434b5b7119637e94a" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_type" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "name" VARCHAR(63) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_9faf22bda466ac1ca2c126b5a0a" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_d6f5a52b1a96dd8d0591f9fbc47" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_locale" (
    "faq_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "question" VARCHAR NOT NULL,
    "answer" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_53503b36e2adb7267a5eab03012" PRIMARY KEY ("faq_id","locale_id")
);

-- CreateTable
CREATE TABLE "file" (
    "id" SERIAL NOT NULL,
    "filename" VARCHAR NOT NULL,
    "path" VARCHAR NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "location" VARCHAR NOT NULL,
    "mimetype_id" INTEGER NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_36b46d232307066b3a2c9ea3a1d" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_mimetype" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_893f78c26bcde79a87cc0fe45a5" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_provider" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_afb71f4bd9709183d4f8d4c8ad2" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_provider_locale" (
    "provider_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "name" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_c108e943a38100608cfae509b3a" PRIMARY KEY ("provider_id","locale_id")
);

-- CreateTable
CREATE TABLE "instance" (
    "id" SERIAL NOT NULL,
    "component_id" INTEGER NOT NULL,
    "name" VARCHAR NOT NULL,
    "parent_id" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "visibility" "instance_visibility_enum" NOT NULL DEFAULT 'private',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_eaf60e4a0c399c9935413e06474" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instance_prop" (
    "id" SERIAL NOT NULL,
    "prop_id" INTEGER NOT NULL,
    "instance_id" INTEGER NOT NULL,
    "value" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_5fb532f06e1e4f11bd3d54eb760" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "name" VARCHAR NOT NULL,
    "price" DECIMAL NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_d3c0c71f23e7adcf952a1d13423" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locale" (
    "id" SERIAL NOT NULL,
    "code" CHAR(2) NOT NULL,
    "region" CHAR(2) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_4b7a3ebe8ec48f1bb2c4b80e349" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_5407da42b983ba54c6c62d462d3" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_locale" (
    "mail_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "subject" VARCHAR NOT NULL,
    "body" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_f20e01e389b6a9f9edfee2aaea5" PRIMARY KEY ("mail_id","locale_id")
);

-- CreateTable
CREATE TABLE "mail_sent" (
    "id" SERIAL NOT NULL,
    "mail_id" INTEGER NOT NULL,
    "subject" VARCHAR NOT NULL,
    "from" VARCHAR NOT NULL,
    "to" VARCHAR,
    "cc" VARCHAR,
    "bcc" VARCHAR,
    "body" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_e270163b87ab8ee62cd8f3d4d53" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_var" (
    "id" SERIAL NOT NULL,
    "mail_id" INTEGER NOT NULL,
    "name" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_1c8349729c6b8abfc8ae33dad2d" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu" (
    "id" SERIAL NOT NULL,
    "menu_id" INTEGER,
    "slug" VARCHAR(255) NOT NULL,
    "url" VARCHAR,
    "order" INTEGER NOT NULL DEFAULT 0,
    "icon" VARCHAR,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_35b2a8f47d153ff7a41860cceeb" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_locale" (
    "menu_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "name" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_c79932cd650be458f1540d97b08" PRIMARY KEY ("menu_id","locale_id")
);

-- CreateTable
CREATE TABLE "menu_screen" (
    "menu_id" INTEGER NOT NULL,
    "screen_id" INTEGER NOT NULL,

    CONSTRAINT "PK_cefac3ef25311287e1b40c1059d" PRIMARY KEY ("menu_id","screen_id")
);

-- CreateTable
CREATE TABLE "multifactor" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_dd28340c66eb211fbd352507167" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "multifactor_locale" (
    "multifactor_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "name" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_1cc26c48643e0908951b8528fd9" PRIMARY KEY ("multifactor_id","locale_id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "person_id" INTEGER,
    "gateway_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status_id" INTEGER NOT NULL,
    "document" VARCHAR(14),
    "payment_at" TIMESTAMP(6),
    "currency" VARCHAR(3) NOT NULL,
    "method_id" INTEGER,
    "brand_id" INTEGER,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "coupon_id" INTEGER,
    "discount" DECIMAL NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_fcaec7df5adf9cac408c686b2ab" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_card_brand" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "name" VARCHAR(63) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_a6ea58ffbbb38da4bbddebaf3f8" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_coupon" (
    "id" SERIAL NOT NULL,
    "discount_type_id" INTEGER NOT NULL,
    "code" VARCHAR NOT NULL,
    "description" VARCHAR,
    "value" VARCHAR NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "uses_limit" INTEGER,
    "uses_qtd" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMP(6) NOT NULL,
    "ends_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_3aeb69bdbcf05f4cf0e2249c64b" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_coupon_item" (
    "id" SERIAL NOT NULL,
    "coupon_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_88af454778b65a1b203438a8fff" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_gateway" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "name" VARCHAR(63) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_8cd60dcc29059b7a42ea42b0eda" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_installment_item" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "max_installments" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_9447479ab8ddf55a12c3c2a1403" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_item" (
    "id" SERIAL NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "unit_price" DECIMAL NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_2d84c71b8a237456c611ba49362" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_method" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "name" VARCHAR(63) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_7744c2b2dd932c9cf42f2b9bc3a" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_method_item" (
    "id" SERIAL NOT NULL,
    "payment_method_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "discount_type_id" INTEGER NOT NULL,
    "value" DECIMAL NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_80d25d79c428250c5642cf4de57" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_notification" (
    "id" SERIAL NOT NULL,
    "gateway_id" INTEGER NOT NULL,
    "payment_id" INTEGER,
    "log" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_ae851104ce3761a083209783d81" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_status" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_b59e2e874b077ea7acf724e4711" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_status_locale" (
    "payment_status_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "name" VARCHAR(63) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_17f715ac6bb694c99c8ee632542" PRIMARY KEY ("payment_status_id","locale_id")
);

-- CreateTable
CREATE TABLE "payment_value" (
    "id" SERIAL NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "name" VARCHAR NOT NULL,
    "value" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_9506ccc5cd57d212908e0595381" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "photo_id" INTEGER,
    "type_id" INTEGER NOT NULL,
    "birth_at" DATE,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_5fdaf670315c4b7e70cce85daa3" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_address" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "country_id" INTEGER NOT NULL,
    "type_id" INTEGER NOT NULL,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "street" VARCHAR(255) NOT NULL,
    "number" VARCHAR(15),
    "complement" VARCHAR(255),
    "district" VARCHAR(255) NOT NULL,
    "city" VARCHAR(255) NOT NULL,
    "state" VARCHAR(255) NOT NULL,
    "postal_code" VARCHAR(20) NOT NULL,
    "reference" VARCHAR(60),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_cd587348ca3fec07931de208299" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_address_type" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_98a56bf4ddb0cfdc34900b208e8" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_address_type_locale" (
    "type_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "name" VARCHAR(31) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_abe72c4220e51c9098dfc80eaf1" PRIMARY KEY ("type_id","locale_id")
);

-- CreateTable
CREATE TABLE "person_contact" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "type_id" INTEGER NOT NULL,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "value" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_1094fd036d694f9949ef1c19e39" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_contact_type" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_8b9415f3b74feaedaa9a168e2a9" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_contact_type_locale" (
    "type_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "name" VARCHAR(63) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_15b4a1183c23cf4dedaae0014cb" PRIMARY KEY ("type_id","locale_id")
);

-- CreateTable
CREATE TABLE "person_custom" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "type_id" INTEGER NOT NULL,
    "value" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_e418892d4f99f4f134ad258bfc4" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_custom_locale" (
    "custom_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "name" VARCHAR(31) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_231532c3290c4a720f1dff45564" PRIMARY KEY ("custom_id","locale_id")
);

-- CreateTable
CREATE TABLE "person_custom_type" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_e825bcc04099f5404c566de8b84" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_custom_type_locale" (
    "type_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "name" VARCHAR(31) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_f17d0fb0d468e783799bc5b3e26" PRIMARY KEY ("type_id","locale_id")
);

-- CreateTable
CREATE TABLE "person_document" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "type_id" INTEGER NOT NULL,
    "country_id" INTEGER NOT NULL,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "value" VARCHAR(63) NOT NULL,
    "issued_at" DATE,
    "expiry_at" DATE,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_bcc56725609d81e79e21031dd56" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_document_type" (
    "id" SERIAL NOT NULL,
    "country_id" INTEGER NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_866923f2a0938b2fe81b6de8367" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_document_type_locale" (
    "type_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "name" VARCHAR(63) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_a66b893bcdfc402febbb79227e7" PRIMARY KEY ("type_id","locale_id")
);

-- CreateTable
CREATE TABLE "person_type" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_f900a8c313411c7da8fcbba7975" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_type_locale" (
    "type_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "name" VARCHAR(31) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_817fb03a35a6d045af0ef30603c" PRIMARY KEY ("type_id","locale_id")
);

-- CreateTable
CREATE TABLE "person_user" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_5157fa65538cae06e66c922c898" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_value" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_85c28f48f06f5cc8291d45e1554" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating" (
    "id" SERIAL NOT NULL,
    "comment" VARCHAR NOT NULL,
    "note" DECIMAL(2,0) NOT NULL,
    "person_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_ecda8ad32645327e4765b43649e" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_locale" (
    "role_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_c259035e32b4022042cd99aa948" PRIMARY KEY ("role_id","locale_id")
);

-- CreateTable
CREATE TABLE "role_menu" (
    "role_id" INTEGER NOT NULL,
    "menu_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_ec8ce21a3846c0f4f3b59c3d310" PRIMARY KEY ("role_id","menu_id")
);

-- CreateTable
CREATE TABLE "role_route" (
    "role_id" INTEGER NOT NULL,
    "route_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_925753da26ee2b077ab7428ed06" PRIMARY KEY ("role_id","route_id")
);

-- CreateTable
CREATE TABLE "role_screen" (
    "role_id" INTEGER NOT NULL,
    "screen_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_e12b4dd3c676dfc208c4d50366f" PRIMARY KEY ("role_id","screen_id")
);

-- CreateTable
CREATE TABLE "role_user" (
    "role_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_0d02ac0493a7a8193048bbc7da5" PRIMARY KEY ("role_id","user_id")
);

-- CreateTable
CREATE TABLE "route" (
    "id" SERIAL NOT NULL,
    "url" VARCHAR NOT NULL,
    "method" "route_method_enum" NOT NULL,
    "description" VARCHAR,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_08affcd076e46415e5821acf52d" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_screen" (
    "route_id" INTEGER NOT NULL,
    "screen_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_76272b0e5954880b0cece9a0a05" PRIMARY KEY ("route_id","screen_id")
);

-- CreateTable
CREATE TABLE "screen" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "icon" VARCHAR,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_7d30806a7556636b84d24e75f4d" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screen_locale" (
    "screen_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_1cd85e4f1dd3e6616bd6a960db2" PRIMARY KEY ("screen_id","locale_id")
);

-- CreateTable
CREATE TABLE "setting" (
    "id" SERIAL NOT NULL,
    "group_id" INTEGER NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "type" "setting_type_enum" NOT NULL DEFAULT 'string',
    "value" VARCHAR(1023),
    "user_override" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_fcb21187dc6094e24a48f677bed" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setting_group" (
    "id" SERIAL NOT NULL,
    "icon" VARCHAR(31) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_07f390cb981a5f4bb7a4a354d06" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setting_group_locale" (
    "locale_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "name" VARCHAR(63) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_ba363f06d3eeec8e42345d205d1" PRIMARY KEY ("locale_id","group_id")
);

-- CreateTable
CREATE TABLE "setting_locale" (
    "locale_id" INTEGER NOT NULL,
    "setting_id" INTEGER NOT NULL,
    "description" VARCHAR(255),
    "name" VARCHAR(63),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_388a9fe9b33b00aff31d26f0912" PRIMARY KEY ("locale_id","setting_id")
);

-- CreateTable
CREATE TABLE "setting_user" (
    "user_id" INTEGER NOT NULL,
    "setting_id" INTEGER NOT NULL,
    "value" VARCHAR(1023),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_9b9f9a08cecc632f2da8f12f4da" PRIMARY KEY ("user_id","setting_id")
);

-- CreateTable
CREATE TABLE "subscription" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "status" "subscription_status_enum" NOT NULL,
    "limit" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_8c3e00ebd02103caa1174cd5d9d" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_cancel" (
    "id" SERIAL NOT NULL,
    "subscription_id" INTEGER NOT NULL,
    "person_id" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_cd154e1c877cb83c972941509a0" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_cancel_reason" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_17b23fd0d5d7739c46ae7dd559d" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_cancel_reason_choose" (
    "id" SERIAL NOT NULL,
    "cancel_id" INTEGER NOT NULL,
    "reason_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_4fbfb29ff0d6526d15c7be141ed" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_cancel_reason_locale" (
    "cancel_reason_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_cd2221386e94f870fcbc48b8de2" PRIMARY KEY ("cancel_reason_id","locale_id")
);

-- CreateTable
CREATE TABLE "subscription_payment" (
    "id" SERIAL NOT NULL,
    "subscription_id" INTEGER NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "start_at" TIMESTAMP(6) NOT NULL,
    "end_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_25f8afce4159ee83cf8c6da622d" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_person" (
    "id" SERIAL NOT NULL,
    "subscription_id" INTEGER NOT NULL,
    "person_id" INTEGER NOT NULL,
    "role" "subscription_person_role_enum" NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_3bd1a4efea4d53be30499e87c35" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plan" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "duration" "subscription_plan_duration_enum" NOT NULL,
    "item_id" INTEGER,
    "limit" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_5fde988e5d9b9a522d70ebec27c" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plan_gateway" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "gateway_id" INTEGER NOT NULL,
    "gateway_plan_id" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_33b4394e9e974604edc8b352030" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plan_locale" (
    "plan_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "name" VARCHAR(63) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_ecfce02062c255ed5ba6dcf6ab9" PRIMARY KEY ("plan_id","locale_id")
);

-- CreateTable
CREATE TABLE "subscription_value" (
    "id" SERIAL NOT NULL,
    "subscription_id" INTEGER NOT NULL,
    "name" VARCHAR NOT NULL,
    "value" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_f5e733abb3a71f73fd0851852c4" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_8e4052373c579afc1471f526760" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_locale" (
    "tag_id" INTEGER NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "name" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_9f1ae78c09ce4a2e1866c2f5b9a" PRIMARY KEY ("tag_id","locale_id")
);

-- CreateTable
CREATE TABLE "translation" (
    "id" SERIAL NOT NULL,
    "locale_id" INTEGER NOT NULL,
    "namespace_id" INTEGER NOT NULL,
    "name" VARCHAR NOT NULL,
    "value" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_7aef875e43ab80d34a0cdd39c70" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_namespace" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_cf3aa3ba3594c508de49e411c2b" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "multifactor_id" INTEGER,
    "name" VARCHAR NOT NULL,
    "email" VARCHAR NOT NULL,
    "password" VARCHAR NOT NULL,
    "code" VARCHAR,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_activity" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "ip" VARCHAR NOT NULL,
    "user_agent" VARCHAR NOT NULL,
    "message" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_daec6d19443689bda7d7785dff5" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_code_recovery" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "code" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_dc9b7c7e2b3aa6e50fb4d2bd155" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_bec464dd8d54c39c54fd32e2334" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_person" (
    "id" SERIAL NOT NULL,
    "wallet_id" INTEGER NOT NULL,
    "person_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_835506eb11a656262fb8a464862" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transaction" (
    "id" SERIAL NOT NULL,
    "wallet_id" INTEGER NOT NULL,
    "type" "wallet_transaction_type_enum" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_62a01b9c3a734b96a08c621b371" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UQ_cb73208f151aa71cdd78f662d70" ON "category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_0bc9e7abdc2a205fe4c36ad321b" ON "chat"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_56861c12f658bc23575910932ab" ON "component_prop_type"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_c031cdb8eda1b12376a4671524f" ON "component_type"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_dfe3ab560d448427f463febbe77" ON "content"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_49de5ef1bf76edb040ae4e91b0d" ON "dashboard"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_61131edec39967aeebdb9749859" ON "dashboard_component"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_f3ebb1afc775eed2f67d1dad4af" ON "discount_type"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_0f77842c93ceb8c6624a58f538a" ON "item"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_03f3269461e7b003dca6b1699f4" ON "locale"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_a33780fee5a320eaff8caff4b60" ON "mail"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_c4d9533c4ce3f7902c786141e1a" ON "menu"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_a108f605bb3787f098bd7169681" ON "multifactor"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_865d8996a94ef2df5e9eb829bf4" ON "payment"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_7274a61eee5e76dc7e8455bca89" ON "payment_card_brand"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_668178aba2ee336b898a8f7fc7d" ON "payment_coupon"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_915a5db40fb02aed4fdec587771" ON "payment_gateway"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_51f87847674726e4684b9b6c913" ON "payment_installment_item"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_d245144e0dcd3e72b4959aa505d" ON "payment_method"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_a754a6fa331a52327f38f71d05a" ON "payment_status"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "IDX_1c6b62d90e77f5589e1bdbd6f0" ON "payment_value"("payment_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_f86ef99dbbeeab917378b321b73" ON "person_address_type"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "IDX_1c9c355240616acf5547da502b" ON "person_contact"("person_id", "type_id", "value");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_43846dd854b33149094feb9fb4e" ON "person_contact_type"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "IDX_48703a5e36d343a9b33145fe51" ON "person_custom"("person_id", "type_id");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_cffbae416f17b46f8ee51418720" ON "person_custom_type"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "IDX_610e49816c6705dc651e957d54" ON "person_document"("person_id", "type_id", "value");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_181b871128bea16a4ae019d31e3" ON "person_document_type"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_e450c84833fbeb5e6bce51b4805" ON "person_type"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_5d4c8dea076f83721ef1a631315" ON "person_type_locale"("name");

-- CreateIndex
CREATE UNIQUE INDEX "IDX_ef5e2f7360738679f7b658957f" ON "person_user"("person_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_35c9b140caaf6da09cfabb0d675" ON "role"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "IDX_19974683ac52f73bd0d53aa39a" ON "route"("url", "method");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_3b15715a42af9a149b4391b3818" ON "screen"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_a055323cfcbfdef8ab19b5e8b84" ON "setting"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_761e8f4022a795ae7eee22581ca" ON "setting_group"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "IDX_6e9458383cf002c147d28d6483" ON "subscription_cancel"("subscription_id", "person_id");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_7489066408e48e01f0f9b6f3bfe" ON "subscription_cancel_reason"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "IDX_207d14fc857328281dc1d16626" ON "subscription_cancel_reason_choose"("cancel_id", "reason_id");

-- CreateIndex
CREATE UNIQUE INDEX "IDX_c43fb80a6dae770c1bc9307cba" ON "subscription_payment"("subscription_id", "payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "IDX_305396c7f6cb429f28ee5e9a7f" ON "subscription_person"("subscription_id", "person_id");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_a8b506b29b6676308f7c0fc6613" ON "subscription_plan"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "IDX_216bbd68ec714c08512b9e40fe" ON "subscription_value"("subscription_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_3413aed3ecde54f832c4f44f045" ON "tag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "IDX_86152a28a0b83d37df0bb67c85" ON "translation"("locale_id", "namespace_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_e12875dfb3b1d92d7d7c5377e22" ON "user"("email");

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "FK_cc7f32b7ab33c70b9e715afae84" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "category_locale" ADD CONSTRAINT "FK_42628cb0187a1a24f9fedaf0283" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "category_locale" ADD CONSTRAINT "FK_c1b493b4088aac71fcfc899a597" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "FK_634db173c52edece8dd88ea3d4c" FOREIGN KEY ("chat_id") REFERENCES "chat"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "FK_dccda5182e0719bbc6e33f3b695" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat_person" ADD CONSTRAINT "FK_2bb6c5b563f83dbab8ce93f9585" FOREIGN KEY ("chat_id") REFERENCES "chat"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat_person" ADD CONSTRAINT "FK_d0253687a51aec672651c36ec01" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "component" ADD CONSTRAINT "FK_342675811724f592a8f57a6c6b9" FOREIGN KEY ("type_id") REFERENCES "component_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "component_prop" ADD CONSTRAINT "FK_4fd25da5ccf98c6a24001056cd8" FOREIGN KEY ("type_id") REFERENCES "component_prop_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "component_prop" ADD CONSTRAINT "FK_99a4ad518682bd974c908bae828" FOREIGN KEY ("component_id") REFERENCES "component"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "component_prop_type_locale" ADD CONSTRAINT "FK_3353462d24bbeb9842b6a73ea68" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "component_prop_type_locale" ADD CONSTRAINT "FK_d788d55133910b6aff5f694d8c6" FOREIGN KEY ("type_id") REFERENCES "component_prop_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "component_type_locale" ADD CONSTRAINT "FK_4740d9badfe73b02e6ac798eda9" FOREIGN KEY ("type_id") REFERENCES "component_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "component_type_locale" ADD CONSTRAINT "FK_930b65186ce6c9a8cfcc629b7f9" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "content_locale" ADD CONSTRAINT "FK_0e00c768c4316d5633cadce4590" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "content_locale" ADD CONSTRAINT "FK_b294e66290fce43f3b3e738c769" FOREIGN KEY ("content_id") REFERENCES "content"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "country_locale" ADD CONSTRAINT "FK_a9c5e221cc5ea25684c6e486b86" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "country_locale" ADD CONSTRAINT "FK_f6078a6569013351b3a316f8f98" FOREIGN KEY ("country_id") REFERENCES "country"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dashboard_component_locale" ADD CONSTRAINT "FK_0f2eba6ea6564d58125eb0a34b4" FOREIGN KEY ("component_id") REFERENCES "dashboard_component"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dashboard_component_locale" ADD CONSTRAINT "FK_1caa002d6c3f5d188e3d992a922" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dashboard_item" ADD CONSTRAINT "FK_3a78515cb558278423e37cbee3e" FOREIGN KEY ("component_id") REFERENCES "dashboard_component"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dashboard_item" ADD CONSTRAINT "FK_c6b6fb41935b6164a280c5a61e5" FOREIGN KEY ("dashboard_id") REFERENCES "dashboard"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dashboard_locale" ADD CONSTRAINT "FK_715cebc1d9efa853ee50734bc64" FOREIGN KEY ("dashboard_id") REFERENCES "dashboard"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dashboard_locale" ADD CONSTRAINT "FK_d567466467ab5a0b9f8a2bc5175" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dashboard_user" ADD CONSTRAINT "FK_8f31fe77228612efaa2385eaa6c" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dashboard_user" ADD CONSTRAINT "FK_c2d94e6302ebca142bb77db81d8" FOREIGN KEY ("item_id") REFERENCES "dashboard_item"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "faq_locale" ADD CONSTRAINT "FK_50d3de17398f8de283a91137c79" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "faq_locale" ADD CONSTRAINT "FK_7f452a3b8b391aa822725b0ed45" FOREIGN KEY ("faq_id") REFERENCES "faq"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "FK_893f78c26bcde79a87cc0fe45a5" FOREIGN KEY ("mimetype_id") REFERENCES "file_mimetype"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "FK_afb71f4bd9709183d4f8d4c8ad2" FOREIGN KEY ("provider_id") REFERENCES "file_provider"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "file_provider_locale" ADD CONSTRAINT "FK_3ebdcb105301319377557c272bc" FOREIGN KEY ("provider_id") REFERENCES "file_provider"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "file_provider_locale" ADD CONSTRAINT "FK_4fba1720defa9d0f6a9112ddc89" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "instance" ADD CONSTRAINT "FK_5680c054811cb005107f15e6763" FOREIGN KEY ("component_id") REFERENCES "component"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "instance" ADD CONSTRAINT "FK_c78c456e0ba0c9c0a88c7d4aca2" FOREIGN KEY ("parent_id") REFERENCES "instance"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "instance_prop" ADD CONSTRAINT "FK_621d74b82be4d0ffdc64dbd0854" FOREIGN KEY ("instance_id") REFERENCES "instance"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "instance_prop" ADD CONSTRAINT "FK_9f707a6993a985d633b8f4502f0" FOREIGN KEY ("prop_id") REFERENCES "component_prop"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mail_locale" ADD CONSTRAINT "FK_015df518bb5e8b58fb22d3f65eb" FOREIGN KEY ("mail_id") REFERENCES "mail"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mail_locale" ADD CONSTRAINT "FK_625e760da559650587143929b86" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mail_sent" ADD CONSTRAINT "FK_05010af2c9c832519a05780fba7" FOREIGN KEY ("mail_id") REFERENCES "mail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_var" ADD CONSTRAINT "FK_88b8d9fcc9196ba574fc588147c" FOREIGN KEY ("mail_id") REFERENCES "mail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu" ADD CONSTRAINT "FK_237a0fe43278378e9c5729d17af" FOREIGN KEY ("menu_id") REFERENCES "menu"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "menu_locale" ADD CONSTRAINT "FK_1647d7410791844eb6cc82c424c" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "menu_locale" ADD CONSTRAINT "FK_d375a8d5f738a3b2c4fb13c0609" FOREIGN KEY ("menu_id") REFERENCES "menu"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "menu_screen" ADD CONSTRAINT "FK_429d198bd0ea0d8ecee8426dea0" FOREIGN KEY ("screen_id") REFERENCES "screen"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "menu_screen" ADD CONSTRAINT "FK_de2545ba7d953ec8315ee340485" FOREIGN KEY ("menu_id") REFERENCES "menu"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "multifactor_locale" ADD CONSTRAINT "FK_c2a20be9c49258c1d7ea96c818e" FOREIGN KEY ("multifactor_id") REFERENCES "multifactor"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "multifactor_locale" ADD CONSTRAINT "FK_d5f92b6d1e95a38b5af8470f2fe" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "FK_1a62106f2848bb67d1e816a3458" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "FK_3aeb69bdbcf05f4cf0e2249c64b" FOREIGN KEY ("coupon_id") REFERENCES "payment_coupon"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "FK_4c81f8da826394b0b4cd30374cd" FOREIGN KEY ("brand_id") REFERENCES "payment_card_brand"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "FK_7744c2b2dd932c9cf42f2b9bc3a" FOREIGN KEY ("method_id") REFERENCES "payment_method"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "FK_8cd60dcc29059b7a42ea42b0eda" FOREIGN KEY ("gateway_id") REFERENCES "payment_gateway"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "FK_b59e2e874b077ea7acf724e4711" FOREIGN KEY ("status_id") REFERENCES "payment_status"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_coupon" ADD CONSTRAINT "FK_fde4af52e64ecd3aa511d9451a3" FOREIGN KEY ("discount_type_id") REFERENCES "discount_type"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_coupon_item" ADD CONSTRAINT "FK_052a6599acb785bcbf91e5f052e" FOREIGN KEY ("coupon_id") REFERENCES "payment_coupon"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_coupon_item" ADD CONSTRAINT "FK_b3ce7e16e10ae5463a54723d5df" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_installment_item" ADD CONSTRAINT "FK_51f87847674726e4684b9b6c913" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_item" ADD CONSTRAINT "FK_2a4f9d8439c5d17bff4d8407fe1" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_item" ADD CONSTRAINT "FK_4a68ebebc1fa3a668585bd8c724" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_method_item" ADD CONSTRAINT "FK_1dab5dbdfb4b6589f6236d9596a" FOREIGN KEY ("payment_method_id") REFERENCES "payment_method"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_method_item" ADD CONSTRAINT "FK_39fe85071be37ea7561e1fc619a" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_method_item" ADD CONSTRAINT "FK_fbd1e4b0ab001099b1ae141d5bb" FOREIGN KEY ("discount_type_id") REFERENCES "discount_type"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_notification" ADD CONSTRAINT "FK_6392f2cbf81b291977ddc5c36ce" FOREIGN KEY ("gateway_id") REFERENCES "payment_gateway"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_notification" ADD CONSTRAINT "FK_be4df3133dfcfbfd712d09a5fed" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_status_locale" ADD CONSTRAINT "FK_654df991c730efd8cc0956593b3" FOREIGN KEY ("payment_status_id") REFERENCES "payment_status"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_status_locale" ADD CONSTRAINT "FK_dbf81598026d1523bb6461ce2ea" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_value" ADD CONSTRAINT "FK_fce8c21d9e0b3fa9c1c44e87833" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person" ADD CONSTRAINT "FK_0e7be389f108147763fc682c3c4" FOREIGN KEY ("photo_id") REFERENCES "file"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person" ADD CONSTRAINT "FK_f900a8c313411c7da8fcbba7975" FOREIGN KEY ("type_id") REFERENCES "person_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_address" ADD CONSTRAINT "FK_98a56bf4ddb0cfdc34900b208e8" FOREIGN KEY ("type_id") REFERENCES "person_address_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_address" ADD CONSTRAINT "FK_c84bf730e2289bce49328cf2d55" FOREIGN KEY ("country_id") REFERENCES "country"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_address" ADD CONSTRAINT "FK_ce7df7591d4659be1f5f9218384" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_address_type_locale" ADD CONSTRAINT "FK_475216891864d349bf90a734948" FOREIGN KEY ("type_id") REFERENCES "person_address_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_address_type_locale" ADD CONSTRAINT "FK_8a2ce5d8f409bd9df2be9021cb5" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_contact" ADD CONSTRAINT "FK_8b9415f3b74feaedaa9a168e2a9" FOREIGN KEY ("type_id") REFERENCES "person_contact_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_contact" ADD CONSTRAINT "FK_ed78b7b2d50539bbc6796c70b4e" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_contact_type_locale" ADD CONSTRAINT "FK_365b4ca1cad686ffa840bd6377c" FOREIGN KEY ("type_id") REFERENCES "person_contact_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_contact_type_locale" ADD CONSTRAINT "FK_b982e2621abaf3f9efd9af4d573" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_custom" ADD CONSTRAINT "FK_c27115f8d19d82195c606b7bcc3" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_custom" ADD CONSTRAINT "FK_e825bcc04099f5404c566de8b84" FOREIGN KEY ("type_id") REFERENCES "person_custom_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_custom_locale" ADD CONSTRAINT "FK_25e4394cd983a5393fa880412d2" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_custom_locale" ADD CONSTRAINT "FK_ab0d1ed93722ccddfcb53652f47" FOREIGN KEY ("custom_id") REFERENCES "person_custom"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_custom_type_locale" ADD CONSTRAINT "FK_e9ac6d88013c883cd97bd2db28b" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_custom_type_locale" ADD CONSTRAINT "FK_f3118c1eddf9114712c5accf71e" FOREIGN KEY ("type_id") REFERENCES "person_custom_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_document" ADD CONSTRAINT "FK_096c95b8ff0c64de1cfef949f87" FOREIGN KEY ("country_id") REFERENCES "country"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_document" ADD CONSTRAINT "FK_3d2eefc8668f687831146947b31" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_document" ADD CONSTRAINT "FK_866923f2a0938b2fe81b6de8367" FOREIGN KEY ("type_id") REFERENCES "person_document_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_document_type" ADD CONSTRAINT "FK_9dc1f849a5626abefbc3bcc217a" FOREIGN KEY ("country_id") REFERENCES "country"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_document_type_locale" ADD CONSTRAINT "FK_482ef3427c9e444d7c27fddcb81" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_document_type_locale" ADD CONSTRAINT "FK_61c74c3561c064a68d351103ddb" FOREIGN KEY ("type_id") REFERENCES "person_document_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_type_locale" ADD CONSTRAINT "FK_2eb1f7db6f53ac7dca9cbff7b76" FOREIGN KEY ("type_id") REFERENCES "person_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_type_locale" ADD CONSTRAINT "FK_3cac1af04c04a72706ca0e73242" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_user" ADD CONSTRAINT "FK_c2feca123e94d41c2a5c7dac60c" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_user" ADD CONSTRAINT "FK_d993d5deb3373b92ad6fb033dff" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "person_value" ADD CONSTRAINT "FK_c14f1b61dff84649c565703578b" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rating" ADD CONSTRAINT "FK_e7f06cac356ed6eca27fe71378b" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_locale" ADD CONSTRAINT "FK_2294c27f7b13ae4bd3edd845bfa" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_locale" ADD CONSTRAINT "FK_2f1f8ebc571f696da89d584c250" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_menu" ADD CONSTRAINT "FK_25f45e543fbda0c91da4af7a2a9" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_menu" ADD CONSTRAINT "FK_96d26921e6aa2172256a55a6bc7" FOREIGN KEY ("menu_id") REFERENCES "menu"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_route" ADD CONSTRAINT "FK_cfb587091271544695118e9c05d" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_route" ADD CONSTRAINT "FK_fb62a702db3d0b7f5588c4db7b2" FOREIGN KEY ("route_id") REFERENCES "route"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_screen" ADD CONSTRAINT "FK_299ad30564c8266309fbebd05ab" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_screen" ADD CONSTRAINT "FK_7313f91bf6d625f7e989d7cfc5a" FOREIGN KEY ("screen_id") REFERENCES "screen"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_user" ADD CONSTRAINT "FK_5261e26da61ccaf8aeda8bca8ea" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_user" ADD CONSTRAINT "FK_78ee37f2db349d230d502b1c7ea" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "route_screen" ADD CONSTRAINT "FK_6a7e17a4ddcf97e70ec825faff9" FOREIGN KEY ("route_id") REFERENCES "route"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "route_screen" ADD CONSTRAINT "FK_e0c208670cd186fa86fd3190126" FOREIGN KEY ("screen_id") REFERENCES "screen"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "screen_locale" ADD CONSTRAINT "FK_cb1dfd415b7d620999be342cb70" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "screen_locale" ADD CONSTRAINT "FK_cb802193d021bef9c3156143a73" FOREIGN KEY ("screen_id") REFERENCES "screen"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "setting" ADD CONSTRAINT "FK_07f390cb981a5f4bb7a4a354d06" FOREIGN KEY ("group_id") REFERENCES "setting_group"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "setting_group_locale" ADD CONSTRAINT "FK_5a216b58563d23ffe4fc47c2f81" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "setting_group_locale" ADD CONSTRAINT "FK_9e47153fd708717c436d3016908" FOREIGN KEY ("group_id") REFERENCES "setting_group"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "setting_locale" ADD CONSTRAINT "FK_1cfadfbb033b62b01e9241342ea" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "setting_locale" ADD CONSTRAINT "FK_f78068a8a9924c19c7d33e8bfb8" FOREIGN KEY ("setting_id") REFERENCES "setting"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "setting_user" ADD CONSTRAINT "FK_787278995b974bcb29ac98635e1" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "setting_user" ADD CONSTRAINT "FK_9d2cd571c1eea2008632c07e95f" FOREIGN KEY ("setting_id") REFERENCES "setting"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "FK_5fde988e5d9b9a522d70ebec27c" FOREIGN KEY ("plan_id") REFERENCES "subscription_plan"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription_cancel" ADD CONSTRAINT "FK_76a72b76359d857e690e1e43517" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription_cancel" ADD CONSTRAINT "FK_e56ced3c31df4331d271299f46c" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription_cancel_reason_choose" ADD CONSTRAINT "FK_7b9ba4435cc1725d6ff6450977b" FOREIGN KEY ("reason_id") REFERENCES "subscription_cancel_reason"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription_cancel_reason_choose" ADD CONSTRAINT "FK_b9d7519f4e4de0a67ed635072a7" FOREIGN KEY ("cancel_id") REFERENCES "subscription_cancel"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription_cancel_reason_locale" ADD CONSTRAINT "FK_9ef7da7b0e332654009f22e87f2" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription_cancel_reason_locale" ADD CONSTRAINT "FK_e8eff1168f25ed1201f357e9c5d" FOREIGN KEY ("cancel_reason_id") REFERENCES "subscription_cancel_reason"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription_payment" ADD CONSTRAINT "FK_072314f31171588e2410127b50f" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription_payment" ADD CONSTRAINT "FK_ad0ebe8b66ad9e06c8324a76591" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription_person" ADD CONSTRAINT "FK_cba48b6195fcda08573ca312405" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription_person" ADD CONSTRAINT "FK_df4623396047e162596af878239" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription_plan" ADD CONSTRAINT "FK_b4a309e265627437dd349e9baf0" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription_plan_gateway" ADD CONSTRAINT "FK_7a3bbc2a439d7b5d2a81c9d9534" FOREIGN KEY ("gateway_id") REFERENCES "payment_gateway"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription_plan_gateway" ADD CONSTRAINT "FK_9ec216dafbdaa9c342701ea02be" FOREIGN KEY ("plan_id") REFERENCES "subscription_plan"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription_plan_locale" ADD CONSTRAINT "FK_40f7714bd2e1b0c43ea98acf606" FOREIGN KEY ("plan_id") REFERENCES "subscription_plan"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription_plan_locale" ADD CONSTRAINT "FK_89ec8f615dea2c8228031091674" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription_value" ADD CONSTRAINT "FK_7ae981dc75a2a49c632dd666387" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tag_locale" ADD CONSTRAINT "FK_600d97c71393728acec8db33aac" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tag_locale" ADD CONSTRAINT "FK_86568e454bd38202edf01186a4d" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "translation" ADD CONSTRAINT "FK_70a64feade03541926a4abffe16" FOREIGN KEY ("locale_id") REFERENCES "locale"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "translation" ADD CONSTRAINT "FK_cf3aa3ba3594c508de49e411c2b" FOREIGN KEY ("namespace_id") REFERENCES "translation_namespace"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "FK_9b6db84173251ad3e643083250e" FOREIGN KEY ("multifactor_id") REFERENCES "multifactor"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_activity" ADD CONSTRAINT "FK_11108754ec780c670440e32baad" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_code_recovery" ADD CONSTRAINT "FK_1993b634e11cc6fd942dea1b435" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wallet_person" ADD CONSTRAINT "FK_0834232b3249a773394a0db7224" FOREIGN KEY ("wallet_id") REFERENCES "wallet"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wallet_person" ADD CONSTRAINT "FK_507030dc27450580f653a7113ca" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wallet_transaction" ADD CONSTRAINT "FK_3694dd13a5c66114b4474c86904" FOREIGN KEY ("wallet_id") REFERENCES "wallet"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
