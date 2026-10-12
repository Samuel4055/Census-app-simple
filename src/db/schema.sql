-- Census MVP schema. Works on MySQL 5.7+/8 and MariaDB 10.3+.
-- Coordinates are plain DOUBLE columns and boundaries are GeoJSON text, so no
-- spatial extensions are needed and it runs on budget shared hosting.

CREATE TABLE IF NOT EXISTS census_centres (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  lga VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL DEFAULT 'Bauchi',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Enumeration Areas: boundary is a GeoJSON Polygon stored as text
CREATE TABLE IF NOT EXISTS enumeration_areas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  census_centre_id INT NOT NULL,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  boundary_geojson LONGTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (census_centre_id) REFERENCES census_centres(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  role ENUM('enumerator', 'supervisor', 'administrator') NOT NULL,
  census_centre_id INT NULL,
  enumeration_area_id INT NULL,
  supervisor_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (census_centre_id) REFERENCES census_centres(id),
  FOREIGN KEY (enumeration_area_id) REFERENCES enumeration_areas(id),
  FOREIGN KEY (supervisor_id) REFERENCES users(id)
);

-- client_uuid is generated on the device so offline records de-duplicate on sync
CREATE TABLE IF NOT EXISTS households (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_uuid CHAR(36) NOT NULL UNIQUE,
  enumeration_area_id INT NOT NULL,
  enumerator_id INT NOT NULL,
  head_full_name VARCHAR(150) NOT NULL,
  address TEXT,
  latitude DOUBLE NOT NULL,
  longitude DOUBLE NOT NULL,
  location_in_boundary TINYINT(1) NULL,
  status ENUM('draft', 'queued', 'synced', 'approved', 'rejected') NOT NULL DEFAULT 'draft',
  approved_by INT NULL,
  approved_at TIMESTAMP NULL,
  captured_at DATETIME NOT NULL,
  synced_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ea (enumeration_area_id),
  INDEX idx_status (status),
  FOREIGN KEY (enumeration_area_id) REFERENCES enumeration_areas(id),
  FOREIGN KEY (enumerator_id) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS individuals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  household_id INT NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  age INT NOT NULL,
  sex CHAR(1) NOT NULL,
  relationship_to_head VARCHAR(50) NOT NULL,
  marital_status VARCHAR(30),
  education_level VARCHAR(50),
  occupation VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_household (household_id),
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS validation_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  household_id INT NULL,
  rule_type VARCHAR(30) NOT NULL,
  field_name VARCHAR(60),
  message TEXT NOT NULL,
  resolved TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  device_id VARCHAR(100),
  records_count INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL,
  synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_trail (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40),
  entity_id INT NULL,
  details LONGTEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
