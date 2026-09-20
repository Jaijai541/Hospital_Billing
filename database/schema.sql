-- ============================================================
-- Hospital Billing and Patient Information System
-- Database Schema: hospital_billing_db
-- ============================================================

CREATE DATABASE IF NOT EXISTS hospital_billing_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hospital_billing_db;

-- ============================================================
-- 1. LOOKUP TABLES & REFERENCE DATA (Milestone 1)
-- ============================================================

-- Patient Gender Lookup
CREATE TABLE IF NOT EXISTS Enum_Gender (
    Gender_ID INT AUTO_INCREMENT PRIMARY KEY,
    Gender_Name VARCHAR(20) NOT NULL
);

-- Blood Type Lookup
CREATE TABLE IF NOT EXISTS Enum_Blood_Type (
    Blood_Type_ID INT AUTO_INCREMENT PRIMARY KEY,
    Blood_Type_Name VARCHAR(10) NOT NULL
);

-- Room Classification Lookup (Ward, Semi-Private, Private, ICU)
CREATE TABLE IF NOT EXISTS Enum_Room_Type (
    Room_Type_ID INT AUTO_INCREMENT PRIMARY KEY,
    Type_Name VARCHAR(50) NOT NULL,
    Code_Prefix VARCHAR(10) NOT NULL,
    Is_Active BOOLEAN DEFAULT TRUE              -- Soft Delete
);

-- Doctor Classification (Resident, Attending Specialist)
CREATE TABLE IF NOT EXISTS Enum_Doctor_Type (
    Doctor_Type_ID INT AUTO_INCREMENT PRIMARY KEY,
    Type_Name VARCHAR(50) NOT NULL,
    Is_Active BOOLEAN DEFAULT TRUE              -- Soft Delete
);

-- Hospital Department & Charging Stations
-- (Pharmacy, Radiology, Cardiology, Laboratory, Nurse Station, Rehab, Billing)
CREATE TABLE IF NOT EXISTS Enum_Department_Station (
    Station_ID INT AUTO_INCREMENT PRIMARY KEY,
    Station_Name VARCHAR(50) NOT NULL,
    Code_Prefix VARCHAR(10) NOT NULL,           -- e.g. PHARM, RAD, CARD, LAB, NRS, PT, BLG
    Is_Active BOOLEAN DEFAULT TRUE              -- Soft Delete
);

-- Billing Discounts (Senior Citizen 20%, PWD 20%, Government 10%)
CREATE TABLE IF NOT EXISTS Enum_Discount (
    Discount_ID INT AUTO_INCREMENT PRIMARY KEY,
    Discount_Name VARCHAR(50) NOT NULL,
    Discount_Percentage DECIMAL(5, 2) NOT NULL, -- e.g. 20.00
    Is_Active BOOLEAN DEFAULT TRUE              -- Soft Delete
);

-- System User Access Roles (Admin, Finance Staff, Nurse)
CREATE TABLE IF NOT EXISTS Enum_User_Role (
    Role_ID INT AUTO_INCREMENT PRIMARY KEY,
    Role_Name VARCHAR(50) NOT NULL
);


-- ============================================================
-- 2. MASTER ENTITIES (Milestone 1)
-- ============================================================

-- System User Accounts (Login & Access Control)
CREATE TABLE IF NOT EXISTS System_User (
    User_ID INT AUTO_INCREMENT PRIMARY KEY,
    First_Name VARCHAR(50) NOT NULL,
    Last_Name VARCHAR(50) NOT NULL,
    Username VARCHAR(50) UNIQUE NOT NULL,
    Password_Hash VARCHAR(255) NOT NULL,
    Role_ID INT NOT NULL,
    Is_Active BOOLEAN DEFAULT TRUE,              -- Soft Delete
    FOREIGN KEY (Role_ID) REFERENCES Enum_User_Role(Role_ID)
);

-- Medical Doctors & Professional Fees
CREATE TABLE IF NOT EXISTS Doctor (
    Doctor_ID INT AUTO_INCREMENT PRIMARY KEY,
    First_Name VARCHAR(50) NOT NULL,
    Last_Name VARCHAR(50) NOT NULL,
    Doctor_Type_ID INT NOT NULL,
    Station_ID INT NOT NULL,                     -- Department / Specialty
    Code_Prefix VARCHAR(10) NOT NULL DEFAULT 'DR',
    Base_Round_Fee DECIMAL(10, 2) NOT NULL,      -- Fee per bedside visit
    Is_Active BOOLEAN DEFAULT TRUE,              -- Soft Delete
    FOREIGN KEY (Doctor_Type_ID) REFERENCES Enum_Doctor_Type(Doctor_Type_ID),
    FOREIGN KEY (Station_ID) REFERENCES Enum_Department_Station(Station_ID)
);

-- Hospital Rooms & Beds
CREATE TABLE IF NOT EXISTS Room (
    Room_ID INT AUTO_INCREMENT PRIMARY KEY,
    Room_Number VARCHAR(20) NOT NULL UNIQUE,
    Room_Type_ID INT NOT NULL,
    Daily_Rate DECIMAL(10, 2) NOT NULL,          -- Board & Lodging rate per day
    Is_Available BOOLEAN DEFAULT TRUE,           -- Operational status (vacant/occupied)
    Is_Active BOOLEAN DEFAULT TRUE,              -- Soft Delete (retired room)
    FOREIGN KEY (Room_Type_ID) REFERENCES Enum_Room_Type(Room_Type_ID)
);


-- ============================================================
-- 3. CHARGING CATALOGS (Milestone 1 Master Files)
--    Each catalog is linked to its department and handling staff
-- ============================================================

-- 1. Medicines & Drugs (Dispensed by Pharmacy Staff)
CREATE TABLE IF NOT EXISTS Catalog_Medicine (
    Medicine_ID INT AUTO_INCREMENT PRIMARY KEY,
    Generic_Name VARCHAR(100) NOT NULL,
    Station_ID INT NOT NULL,                     -- Station: Central/In-Patient Pharmacy
    Unit_Price DECIMAL(10, 2) NOT NULL,
    Code_Prefix VARCHAR(10) NOT NULL DEFAULT 'MED',
    Is_Active BOOLEAN DEFAULT TRUE,              -- Soft Delete
    FOREIGN KEY (Station_ID) REFERENCES Enum_Department_Station(Station_ID)
);

-- 2. Equipment & Diagnostic Scans (Handled by Technologist + Interpreting Doctor)
CREATE TABLE IF NOT EXISTS Catalog_Equipment_Scan (
    Scan_ID INT AUTO_INCREMENT PRIMARY KEY,
    Scan_Name VARCHAR(100) NOT NULL,             -- e.g. "Chest X-Ray", "2D Echo", "Head CT-Scan"
    Station_ID INT NOT NULL,                     -- Department: Radiology, Cardiology, Imaging
    Hospital_Fee DECIMAL(10, 2) NOT NULL,         -- Machine, consumables, technologist fee
    Reader_Fee DECIMAL(10, 2) NOT NULL,           -- Specialist doctor interpretation fee
    Total_Fee DECIMAL(10, 2) NOT NULL,            -- Hospital_Fee + Reader_Fee
    Code_Prefix VARCHAR(10) NOT NULL DEFAULT 'RAD',
    Is_Active BOOLEAN DEFAULT TRUE,               -- Soft Delete
    FOREIGN KEY (Station_ID) REFERENCES Enum_Department_Station(Station_ID)
);

-- 3. Clinical Procedures & Services (Handled by Specific Healthcare Staff)
CREATE TABLE IF NOT EXISTS Catalog_Service (
    Service_ID INT AUTO_INCREMENT PRIMARY KEY,
    Service_Name VARCHAR(100) NOT NULL,          -- e.g. "IV Cannulation", "Blood Extraction"
    Station_ID INT NOT NULL,                     -- Department: Nurse Station, Laboratory, Rehab
    Performer_Role VARCHAR(50) NOT NULL,         -- e.g. "Staff Nurse", "Medical Technologist", "Physical Therapist"
    Service_Fee DECIMAL(10, 2) NOT NULL,
    Code_Prefix VARCHAR(10) NOT NULL DEFAULT 'SRV',
    Is_Active BOOLEAN DEFAULT TRUE,               -- Soft Delete
    FOREIGN KEY (Station_ID) REFERENCES Enum_Department_Station(Station_ID)
);


-- ============================================================
-- 4. PATIENT & CLINICAL PROCESS (Milestone 2 - Future Modules)
-- ============================================================

-- Patient Master Directory
CREATE TABLE IF NOT EXISTS Patient (
    Patient_ID INT AUTO_INCREMENT PRIMARY KEY,
    First_Name VARCHAR(50) NOT NULL,
    Last_Name VARCHAR(50) NOT NULL,
    Date_Of_Birth DATE NOT NULL,
    Gender_ID INT NOT NULL,
    Blood_Type_ID INT NOT NULL,
    Contact_Number VARCHAR(20),
    Address VARCHAR(255),
    Emergency_Contact_Name VARCHAR(100),
    Emergency_Contact_Number VARCHAR(20),
    FOREIGN KEY (Gender_ID) REFERENCES Enum_Gender(Gender_ID),
    FOREIGN KEY (Blood_Type_ID) REFERENCES Enum_Blood_Type(Blood_Type_ID)
);

-- Admission Stay Record
CREATE TABLE IF NOT EXISTS Admission (
    Admission_ID INT AUTO_INCREMENT PRIMARY KEY,
    Patient_ID INT NOT NULL,
    Chief_Complaint VARCHAR(500) NOT NULL,
    Admission_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
    Discharge_Date DATETIME NULL,
    Status VARCHAR(20) DEFAULT 'Admitted',       -- 'Admitted', 'Discharged', 'Billed'
    FOREIGN KEY (Patient_ID) REFERENCES Patient(Patient_ID)
);

-- Assigned Doctors Bridge Table (Multiple doctors per patient stay)
CREATE TABLE IF NOT EXISTS Admission_Doctor (
    Admission_Doctor_ID INT AUTO_INCREMENT PRIMARY KEY,
    Admission_ID INT NOT NULL,
    Doctor_ID INT NOT NULL,
    Assigned_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (Admission_ID) REFERENCES Admission(Admission_ID),
    FOREIGN KEY (Doctor_ID) REFERENCES Doctor(Doctor_ID)
);

-- Doctor Bedside Rounds Log
CREATE TABLE IF NOT EXISTS Doctor_Round_Log (
    Round_ID INT AUTO_INCREMENT PRIMARY KEY,
    Admission_Doctor_ID INT NOT NULL,
    Round_Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    Charged_Fee DECIMAL(10, 2) NOT NULL,
    Notes VARCHAR(500) NULL,
    FOREIGN KEY (Admission_Doctor_ID) REFERENCES Admission_Doctor(Admission_Doctor_ID)
);

-- Room Stays and Bed Transfers Log
CREATE TABLE IF NOT EXISTS Room_Transfer_Log (
    Transfer_ID INT AUTO_INCREMENT PRIMARY KEY,
    Admission_ID INT NOT NULL,
    Room_ID INT NOT NULL,
    Date_In DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Date_Out DATETIME NULL,
    Total_Days INT NULL,
    Total_Room_Fee DECIMAL(12, 2) NULL,
    FOREIGN KEY (Admission_ID) REFERENCES Admission(Admission_ID),
    FOREIGN KEY (Room_ID) REFERENCES Room(Room_ID)
);


-- ============================================================
-- 5. BILLING HUB & SETTLEMENT (Milestone 2 & 3 - Future Modules)
-- ============================================================

-- Central Billing Ledger (Unified itemized charges)
CREATE TABLE IF NOT EXISTS Billing_Ledger (
    Ledger_ID INT AUTO_INCREMENT PRIMARY KEY,
    Admission_ID INT NOT NULL,
    Station_ID INT NOT NULL,                     -- Originating charging station
    
    -- Specific item references (Only ONE will have a value per row)
    Medicine_ID INT NULL,
    Scan_ID INT NULL,
    Service_ID INT NULL,
    Round_ID INT NULL,                           -- Links to Doctor_Round_Log
    Transfer_ID INT NULL,                        -- Links to Room_Transfer_Log
    
    Quantity DECIMAL(8, 2) NOT NULL DEFAULT 1.00,
    Unit_Price DECIMAL(10, 2) NOT NULL,
    Total_Charge DECIMAL(12, 2) NOT NULL,
    
    Transaction_Type VARCHAR(20) DEFAULT 'Charge', -- 'Charge' or 'Return'
    Description VARCHAR(255) NULL,
    Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (Admission_ID) REFERENCES Admission(Admission_ID),
    FOREIGN KEY (Station_ID) REFERENCES Enum_Department_Station(Station_ID),
    FOREIGN KEY (Medicine_ID) REFERENCES Catalog_Medicine(Medicine_ID),
    FOREIGN KEY (Scan_ID) REFERENCES Catalog_Equipment_Scan(Scan_ID),
    FOREIGN KEY (Service_ID) REFERENCES Catalog_Service(Service_ID),
    FOREIGN KEY (Round_ID) REFERENCES Doctor_Round_Log(Round_ID),
    FOREIGN KEY (Transfer_ID) REFERENCES Room_Transfer_Log(Transfer_ID)
);

-- Final Settled Invoice / Patient Bill
CREATE TABLE IF NOT EXISTS Final_Invoice (
    Invoice_ID INT AUTO_INCREMENT PRIMARY KEY,
    Admission_ID INT NOT NULL,
    Processed_By_User_ID INT NOT NULL,
    Discount_ID INT NULL,
    Gross_Total DECIMAL(12, 2) NOT NULL,
    Discount_Amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    Net_Amount_Due DECIMAL(12, 2) NOT NULL,
    Settlement_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
    Notes VARCHAR(500) NULL,
    FOREIGN KEY (Admission_ID) REFERENCES Admission(Admission_ID),
    FOREIGN KEY (Processed_By_User_ID) REFERENCES System_User(User_ID),
    FOREIGN KEY (Discount_ID) REFERENCES Enum_Discount(Discount_ID)
);

