-- ============================================================
-- Hospital Billing and Patient Information System
-- Database Schema: hospital_billing_db (Instructor Approved)
-- ============================================================

CREATE DATABASE IF NOT EXISTS hospital_billing_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hospital_billing_db;

-- ============================================================
-- 1. ENUMERATIONS & REFERENCE TABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS Enum_Gender (
    Gender_ID INT AUTO_INCREMENT PRIMARY KEY,
    Gender_Name VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS Enum_Blood_Type (
    Blood_Type_ID INT AUTO_INCREMENT PRIMARY KEY,
    Blood_Type_Name VARCHAR(10) NOT NULL
);

CREATE TABLE IF NOT EXISTS Enum_Room_Type (
    Room_Type_ID INT AUTO_INCREMENT PRIMARY KEY,
    Type_Name VARCHAR(50) NOT NULL, -- e.g., 'Ward', 'Private'
    Code_Prefix VARCHAR(10) NOT NULL,
    Daily_Rate DECIMAL(10, 2) NOT NULL, -- Enforces uniform pricing per room type
    Is_Active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS Enum_Specialty (
    Specialty_ID INT AUTO_INCREMENT PRIMARY KEY,
    Specialty_Name VARCHAR(100) NOT NULL, -- e.g., 'Internal Medicine', 'Cardiology'
    Is_Active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS Enum_Doctor_Type (
    Doctor_Type_ID INT AUTO_INCREMENT PRIMARY KEY,
    Type_Name VARCHAR(50) NOT NULL, -- 'Resident', 'Attending'
    Is_Active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS Enum_Department_Station (
    Station_ID INT AUTO_INCREMENT PRIMARY KEY,
    Station_Name VARCHAR(50) NOT NULL, -- 'Nurse Station', 'Billing', etc.
    Code_Prefix VARCHAR(10) NOT NULL,
    Is_Active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS Enum_Discount (
    Discount_ID INT AUTO_INCREMENT PRIMARY KEY,
    Discount_Name VARCHAR(50) NOT NULL, -- 'Senior Citizen', 'PWD', etc.
    Discount_Percentage DECIMAL(5, 2) NOT NULL,
    Is_Active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS Enum_User_Role (
    Role_ID INT AUTO_INCREMENT PRIMARY KEY,
    Role_Name VARCHAR(50) NOT NULL -- 'Admin', 'Finance Staff', 'Nurse'
);


-- ============================================================
-- 2. MASTER ENTITIES (Users & Doctors)
-- ============================================================
CREATE TABLE IF NOT EXISTS System_User (
    User_ID INT AUTO_INCREMENT PRIMARY KEY,
    First_Name VARCHAR(50) NOT NULL,
    Last_Name VARCHAR(50) NOT NULL,
    Username VARCHAR(50) UNIQUE NOT NULL,
    Password_Hash VARCHAR(255) NOT NULL,
    Role_ID INT NOT NULL,
    Is_Active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (Role_ID) REFERENCES Enum_User_Role(Role_ID)
);

CREATE TABLE IF NOT EXISTS Doctor (
    Doctor_ID INT AUTO_INCREMENT PRIMARY KEY,
    First_Name VARCHAR(50) NOT NULL,
    Last_Name VARCHAR(50) NOT NULL,
    Doctor_Type_ID INT NOT NULL,
    Station_ID INT NOT NULL, 
    Code_Prefix VARCHAR(10) NOT NULL DEFAULT 'DOC',
    Base_Round_Fee DECIMAL(10, 2) NOT NULL,
    Is_Active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (Doctor_Type_ID) REFERENCES Enum_Doctor_Type(Doctor_Type_ID),
    FOREIGN KEY (Station_ID) REFERENCES Enum_Department_Station(Station_ID)
);

-- Bridge Table: A Doctor can have multiple specialties
CREATE TABLE IF NOT EXISTS Doctor_Specialty (
    Doctor_Specialty_ID INT AUTO_INCREMENT PRIMARY KEY,
    Doctor_ID INT NOT NULL,
    Specialty_ID INT NOT NULL,
    FOREIGN KEY (Doctor_ID) REFERENCES Doctor(Doctor_ID) ON DELETE CASCADE,
    FOREIGN KEY (Specialty_ID) REFERENCES Enum_Specialty(Specialty_ID)
);


-- ============================================================
-- 3. ROOM & BED HIERARCHY
-- ============================================================
CREATE TABLE IF NOT EXISTS Room (
    Room_ID INT AUTO_INCREMENT PRIMARY KEY,
    Room_Name VARCHAR(50) NOT NULL, -- e.g., 'Ward A'
    Room_Type_ID INT NOT NULL,
    Capacity INT NOT NULL,          -- Default Daily_Rate defined in Enum_Room_Type
    Custom_Daily_Rate DECIMAL(10, 2) NULL, -- Optional customized rate per room preference
    Is_Active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (Room_Type_ID) REFERENCES Enum_Room_Type(Room_Type_ID)
);

CREATE TABLE IF NOT EXISTS Room_Bed (
    Bed_ID INT AUTO_INCREMENT PRIMARY KEY,
    Room_ID INT NOT NULL,
    Bed_Code VARCHAR(20) NOT NULL, -- e.g., 'WRD-001'
    Is_Available BOOLEAN DEFAULT TRUE,
    Is_Active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (Room_ID) REFERENCES Room(Room_ID) ON DELETE CASCADE
);


-- ============================================================
-- 4. THE UNIFIED CATALOG
-- ============================================================
CREATE TABLE IF NOT EXISTS Charge_Catalogs (
    Catalog_ID INT AUTO_INCREMENT PRIMARY KEY,
    Item_Name VARCHAR(150) NOT NULL,
    Category_Type VARCHAR(50) NOT NULL, -- 'Medicine', 'Equipment Scan', 'Service'
    Code_Prefix VARCHAR(10) NOT NULL,   -- e.g., 'MED', 'RAD', 'SRV'
    Unit_Price DECIMAL(10, 2) NOT NULL,
    Is_Active BOOLEAN DEFAULT TRUE
);


-- ============================================================
-- 5. PATIENT & ADMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS Patient (
    Patient_ID INT AUTO_INCREMENT PRIMARY KEY,
    First_Name VARCHAR(50) NOT NULL,
    Last_Name VARCHAR(50) NOT NULL,
    Date_Of_Birth DATE NOT NULL,
    Gender_ID INT NOT NULL,
    Gender_Specification VARCHAR(50) NULL, -- Custom preference when Gender is 'Other'
    Blood_Type_ID INT NOT NULL,
    Contact_Number VARCHAR(20),
    Address VARCHAR(255),
    Emergency_Contact_Name VARCHAR(100),
    Emergency_Contact_Number VARCHAR(20),
    Is_Active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (Gender_ID) REFERENCES Enum_Gender(Gender_ID),
    FOREIGN KEY (Blood_Type_ID) REFERENCES Enum_Blood_Type(Blood_Type_ID)
);

CREATE TABLE IF NOT EXISTS Admission (
    Admission_ID INT AUTO_INCREMENT PRIMARY KEY,
    Patient_ID INT NOT NULL,
    Chief_Complaint VARCHAR(500) NOT NULL,
    Admission_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
    Status VARCHAR(20) DEFAULT 'Admitted',
    FOREIGN KEY (Patient_ID) REFERENCES Patient(Patient_ID)
);


-- ============================================================
-- 6. CLINICAL WORKFLOWS (Requests, Rounds, Transfers)
-- ============================================================
CREATE TABLE IF NOT EXISTS Admission_Doctor (
    Admission_Doctor_ID INT AUTO_INCREMENT PRIMARY KEY,
    Admission_ID INT NOT NULL,
    Doctor_ID INT NOT NULL,
    Assigned_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (Admission_ID) REFERENCES Admission(Admission_ID),
    FOREIGN KEY (Doctor_ID) REFERENCES Doctor(Doctor_ID)
);

CREATE TABLE IF NOT EXISTS Doctor_Order_Request (
    Request_ID INT AUTO_INCREMENT PRIMARY KEY,
    Admission_Doctor_ID INT NOT NULL,
    Catalog_ID INT NOT NULL,
    Quantity DECIMAL(8, 2) NOT NULL DEFAULT 1.00,
    Status VARCHAR(20) DEFAULT 'Pending', -- 'Pending', 'Administered', 'Cancelled'
    Request_Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    Administered_Timestamp DATETIME NULL,
    FOREIGN KEY (Admission_Doctor_ID) REFERENCES Admission_Doctor(Admission_Doctor_ID),
    FOREIGN KEY (Catalog_ID) REFERENCES Charge_Catalogs(Catalog_ID)
);

CREATE TABLE IF NOT EXISTS Doctor_Round_Log (
    Round_ID INT AUTO_INCREMENT PRIMARY KEY,
    Admission_Doctor_ID INT NOT NULL,
    Round_Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    Charged_Fee DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (Admission_Doctor_ID) REFERENCES Admission_Doctor(Admission_Doctor_ID)
);

CREATE TABLE IF NOT EXISTS Room_Transfer_Log (
    Transfer_ID INT AUTO_INCREMENT PRIMARY KEY,
    Admission_ID INT NOT NULL,
    Bed_ID INT NOT NULL, -- Links to specific bed, not just the room
    Date_In DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Date_Out DATETIME NULL,
    Total_Days INT NULL,
    Total_Room_Fee DECIMAL(12, 2) NULL,
    FOREIGN KEY (Admission_ID) REFERENCES Admission(Admission_ID),
    FOREIGN KEY (Bed_ID) REFERENCES Room_Bed(Bed_ID)
);


-- ============================================================
-- 7. THE BILLING HUB (Ledger & Final Invoice)
-- ============================================================
CREATE TABLE IF NOT EXISTS Billing_Ledger (
    Ledger_ID INT AUTO_INCREMENT PRIMARY KEY,
    Admission_ID INT NOT NULL,
    Station_ID INT NOT NULL, 
    
    -- Transaction References (Only ONE will be populated per row)
    Catalog_ID INT NULL,    -- Direct floor stock charges by a nurse
    Request_ID INT NULL,    -- Formal orders requested by a doctor
    Round_ID INT NULL,      -- Doctor visit fees
    Transfer_ID INT NULL,   -- Board & Lodging fees
    
    Quantity DECIMAL(8, 2) NOT NULL,
    Unit_Price DECIMAL(10, 2) NOT NULL,
    Total_Charge DECIMAL(12, 2) NOT NULL,
    
    Transaction_Type VARCHAR(20) DEFAULT 'Charge', -- Can be 'Return'
    Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (Admission_ID) REFERENCES Admission(Admission_ID),
    FOREIGN KEY (Station_ID) REFERENCES Enum_Department_Station(Station_ID),
    FOREIGN KEY (Catalog_ID) REFERENCES Charge_Catalogs(Catalog_ID),
    FOREIGN KEY (Request_ID) REFERENCES Doctor_Order_Request(Request_ID),
    FOREIGN KEY (Round_ID) REFERENCES Doctor_Round_Log(Round_ID),
    FOREIGN KEY (Transfer_ID) REFERENCES Room_Transfer_Log(Transfer_ID)
);

CREATE TABLE IF NOT EXISTS Final_Invoice (
    Invoice_ID INT AUTO_INCREMENT PRIMARY KEY,
    Admission_ID INT NOT NULL,
    Processed_By_User_ID INT NOT NULL,
    Discount_ID INT NULL,
    Gross_Total DECIMAL(12, 2) NOT NULL,
    Discount_Amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    Net_Amount_Due DECIMAL(12, 2) NOT NULL,
    Settlement_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (Admission_ID) REFERENCES Admission(Admission_ID),
    FOREIGN KEY (Processed_By_User_ID) REFERENCES System_User(User_ID),
    FOREIGN KEY (Discount_ID) REFERENCES Enum_Discount(Discount_ID)
);
