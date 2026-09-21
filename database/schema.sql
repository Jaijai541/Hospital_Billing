-- ============================================================
-- Hospital Billing and Patient Information System
-- Database Schema: hospital_billing_db (Revised Architecture)
-- ============================================================

CREATE DATABASE IF NOT EXISTS hospital_billing_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hospital_billing_db;

-- ============================================================
-- 1. LOOKUP TABLES & ENUMERATIONS (Dedicated table per attribute)
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
    Daily_Rate DECIMAL(10, 2) NOT NULL DEFAULT 500.00,
    Is_Active BOOLEAN DEFAULT TRUE
);

-- Doctor Classification (Resident, Attending Specialist)
CREATE TABLE IF NOT EXISTS Enum_Doctor_Type (
    Doctor_Type_ID INT AUTO_INCREMENT PRIMARY KEY,
    Type_Name VARCHAR(50) NOT NULL,
    Is_Active BOOLEAN DEFAULT TRUE
);

-- Doctor Medical Specialties (Internal Medicine, Cardiology, etc.)
CREATE TABLE IF NOT EXISTS Enum_Specialty (
    Specialty_ID INT AUTO_INCREMENT PRIMARY KEY,
    Specialty_Name VARCHAR(100) NOT NULL,
    Is_Active BOOLEAN DEFAULT TRUE
);

-- Hospital Department & Charging Stations
CREATE TABLE IF NOT EXISTS Enum_Department_Station (
    Station_ID INT AUTO_INCREMENT PRIMARY KEY,
    Station_Name VARCHAR(50) NOT NULL,
    Code_Prefix VARCHAR(10) NOT NULL,           -- e.g. PHARM, RAD, CARD, LAB, NRS, PT, BLG
    Is_Active BOOLEAN DEFAULT TRUE
);

-- Charge Catalog Types (Medicines, Equipment Scans, Procedures)
CREATE TABLE IF NOT EXISTS Enum_Catalog_Type (
    Catalog_Type_ID INT AUTO_INCREMENT PRIMARY KEY,
    Type_Name VARCHAR(50) NOT NULL,             -- 'Medicine', 'Equipment / Scan', 'Procedure / Service'
    Code_Prefix VARCHAR(10) NOT NULL,           -- 'MED', 'RAD', 'SRV'
    Is_Active BOOLEAN DEFAULT TRUE
);

-- Billing Discounts (Senior Citizen 20%, PWD 20%, Government 10%)
CREATE TABLE IF NOT EXISTS Enum_Discount (
    Discount_ID INT AUTO_INCREMENT PRIMARY KEY,
    Discount_Name VARCHAR(50) NOT NULL,
    Discount_Percentage DECIMAL(5, 2) NOT NULL,
    Is_Active BOOLEAN DEFAULT TRUE
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
    User_Code VARCHAR(20) NOT NULL DEFAULT 'USR-001',
    First_Name VARCHAR(50) NOT NULL,
    Last_Name VARCHAR(50) NOT NULL,
    Username VARCHAR(50) UNIQUE NOT NULL,
    Password_Hash VARCHAR(255) NOT NULL,
    Role_ID INT NOT NULL,
    Is_Active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (Role_ID) REFERENCES Enum_User_Role(Role_ID)
);

-- Patient Master Directory (No Allergen field as per billing scope)
CREATE TABLE IF NOT EXISTS Patient (
    Patient_ID INT AUTO_INCREMENT PRIMARY KEY,
    Patient_Code VARCHAR(20) NOT NULL UNIQUE,   -- e.g. PAT-001
    First_Name VARCHAR(50) NOT NULL,
    Last_Name VARCHAR(50) NOT NULL,
    Date_Of_Birth DATE NOT NULL,
    Gender_ID INT NOT NULL,
    Blood_Type_ID INT NOT NULL,
    Contact_Number VARCHAR(20),
    Address VARCHAR(255),
    Emergency_Contact_Name VARCHAR(100),
    Emergency_Contact_Number VARCHAR(20),
    Is_Active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (Gender_ID) REFERENCES Enum_Gender(Gender_ID),
    FOREIGN KEY (Blood_Type_ID) REFERENCES Enum_Blood_Type(Blood_Type_ID)
);

-- Medical Doctors (Resident & Attending)
CREATE TABLE IF NOT EXISTS Doctor (
    Doctor_ID INT AUTO_INCREMENT PRIMARY KEY,
    Doctor_Code VARCHAR(20) NOT NULL UNIQUE,   -- e.g. DR-001
    First_Name VARCHAR(50) NOT NULL,
    Last_Name VARCHAR(50) NOT NULL,
    Doctor_Type_ID INT NOT NULL,
    Base_Round_Fee DECIMAL(10, 2) NOT NULL,     -- Fee charged per bedside round
    Is_Active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (Doctor_Type_ID) REFERENCES Enum_Doctor_Type(Doctor_Type_ID)
);

-- Doctor Multiple Specialties Bridge Table
CREATE TABLE IF NOT EXISTS Doctor_Specialty (
    Doctor_ID INT NOT NULL,
    Specialty_ID INT NOT NULL,
    PRIMARY KEY (Doctor_ID, Specialty_ID),
    FOREIGN KEY (Doctor_ID) REFERENCES Doctor(Doctor_ID) ON DELETE CASCADE,
    FOREIGN KEY (Specialty_ID) REFERENCES Enum_Specialty(Specialty_ID)
);

-- Hospital Rooms & Wards
CREATE TABLE IF NOT EXISTS Room (
    Room_ID INT AUTO_INCREMENT PRIMARY KEY,
    Room_Number VARCHAR(20) NOT NULL UNIQUE,   -- e.g. WRD-01, PVT-101
    Room_Type_ID INT NOT NULL,
    Daily_Rate DECIMAL(10, 2) NOT NULL,         -- Board & Lodging rate per day
    Capacity_Beds INT NOT NULL DEFAULT 1,       -- Number of beds fitted in this ward/room
    Is_Active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (Room_Type_ID) REFERENCES Enum_Room_Type(Room_Type_ID)
);

-- Hospital Beds (Each Bed belongs to a Room/Ward)
CREATE TABLE IF NOT EXISTS Bed (
    Bed_ID INT AUTO_INCREMENT PRIMARY KEY,
    Room_ID INT NOT NULL,
    Bed_Number VARCHAR(20) NOT NULL,            -- e.g. Bed-01, Bed-02
    Bed_Code VARCHAR(30) NOT NULL UNIQUE,       -- e.g. WRD-01-B01, PVT-101-B01
    Is_Available BOOLEAN DEFAULT TRUE,          -- Vacant (1) or Occupied (0)
    Is_Active BOOLEAN DEFAULT TRUE,             -- Soft delete
    FOREIGN KEY (Room_ID) REFERENCES Room(Room_ID) ON DELETE CASCADE
);

-- Unified Charge Catalogs (Merged Medicines, Equipment Scans, Procedures)
CREATE TABLE IF NOT EXISTS Charge_Catalog (
    Item_ID INT AUTO_INCREMENT PRIMARY KEY,
    Catalog_Type_ID INT NOT NULL,               -- 1: Medicine, 2: Scan, 3: Procedure
    Station_ID INT NOT NULL,                    -- Originating department
    Item_Code VARCHAR(20) NOT NULL UNIQUE,      -- e.g. MED-001, RAD-001, SRV-001
    Item_Name VARCHAR(150) NOT NULL,
    Hospital_Fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    Reader_Fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    Total_Fee DECIMAL(10, 2) NOT NULL,          -- Hospital_Fee + Reader_Fee
    Performer_Role VARCHAR(100) NULL,           -- e.g. Staff Nurse, MedTech, Specialist
    Is_Active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (Catalog_Type_ID) REFERENCES Enum_Catalog_Type(Catalog_Type_ID),
    FOREIGN KEY (Station_ID) REFERENCES Enum_Department_Station(Station_ID)
);


-- ============================================================
-- 3. ADMISSION & CLINICAL PROCESS (Milestone 2 Foundations)
-- ============================================================

-- Patient In-Patient Admission
CREATE TABLE IF NOT EXISTS Admission (
    Admission_ID INT AUTO_INCREMENT PRIMARY KEY,
    Patient_ID INT NOT NULL,
    Chief_Complaint VARCHAR(500) NOT NULL,      -- Symptoms / reasons (no clinical diagnosis)
    Admission_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
    Discharge_Date DATETIME NULL,
    Status VARCHAR(20) DEFAULT 'Admitted',       -- 'Admitted', 'Transferring', 'Discharged', 'Billed'
    FOREIGN KEY (Patient_ID) REFERENCES Patient(Patient_ID)
);

-- Assigned Doctors Bridge (A patient can have multiple doctors)
CREATE TABLE IF NOT EXISTS Admission_Doctor (
    Admission_Doctor_ID INT AUTO_INCREMENT PRIMARY KEY,
    Admission_ID INT NOT NULL,
    Doctor_ID INT NOT NULL,
    Assigned_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (Admission_ID) REFERENCES Admission(Admission_ID),
    FOREIGN KEY (Doctor_ID) REFERENCES Doctor(Doctor_ID)
);

-- Doctor Bedside Rounds Log (Counts every visit and fee)
CREATE TABLE IF NOT EXISTS Doctor_Round_Log (
    Round_ID INT AUTO_INCREMENT PRIMARY KEY,
    Admission_Doctor_ID INT NOT NULL,
    Round_Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    Charged_Fee DECIMAL(10, 2) NOT NULL,
    Notes VARCHAR(500) NULL,
    FOREIGN KEY (Admission_Doctor_ID) REFERENCES Admission_Doctor(Admission_Doctor_ID)
);

-- Board & Lodging / Bed Stay & Room Transfers Log
CREATE TABLE IF NOT EXISTS Room_Transfer_Log (
    Transfer_ID INT AUTO_INCREMENT PRIMARY KEY,
    Admission_ID INT NOT NULL,
    Bed_ID INT NOT NULL,
    Date_In DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Date_Out DATETIME NULL,
    Total_Days INT NULL,
    Total_Room_Fee DECIMAL(12, 2) NULL,
    Status VARCHAR(20) DEFAULT 'Active',        -- 'Active', 'Transferring', 'Completed'
    FOREIGN KEY (Admission_ID) REFERENCES Admission(Admission_ID),
    FOREIGN KEY (Bed_ID) REFERENCES Bed(Bed_ID)
);

-- Doctor Order Requests (Doctor orders before patient receives & charge happens)
CREATE TABLE IF NOT EXISTS Doctor_Order_Request (
    Request_ID INT AUTO_INCREMENT PRIMARY KEY,
    Admission_ID INT NOT NULL,
    Doctor_ID INT NOT NULL,
    Item_ID INT NOT NULL,                       -- From Charge_Catalog
    Quantity DECIMAL(8, 2) NOT NULL DEFAULT 1.00,
    Status VARCHAR(30) DEFAULT 'Requested',     -- 'Requested', 'Dispensed', 'Administered', 'Cancelled'
    Request_Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (Admission_ID) REFERENCES Admission(Admission_ID),
    FOREIGN KEY (Doctor_ID) REFERENCES Doctor(Doctor_ID),
    FOREIGN KEY (Item_ID) REFERENCES Charge_Catalog(Item_ID)
);


-- ============================================================
-- 4. BILLING HUB & SETTLEMENT (Milestone 2 & 3 Foundations)
-- ============================================================

-- Central Billing Ledger (Itemized charges, doctor rounds, room fees, returns)
CREATE TABLE IF NOT EXISTS Billing_Ledger (
    Ledger_ID INT AUTO_INCREMENT PRIMARY KEY,
    Admission_ID INT NOT NULL,
    Station_ID INT NOT NULL,                    -- Charging station
    
    Item_ID INT NULL,                           -- Links to Charge_Catalog (Med/Scan/Procedure)
    Round_ID INT NULL,                          -- Links to Doctor_Round_Log (Doctor visits)
    Transfer_ID INT NULL,                       -- Links to Room_Transfer_Log (Board & Lodging)
    Request_ID INT NULL,                        -- Links to Doctor_Order_Request
    
    Quantity DECIMAL(8, 2) NOT NULL DEFAULT 1.00,
    Unit_Price DECIMAL(10, 2) NOT NULL,
    Total_Charge DECIMAL(12, 2) NOT NULL,       -- Negative if Transaction_Type = 'Return'
    
    Transaction_Type VARCHAR(20) DEFAULT 'Charge', -- 'Charge' or 'Return' (for returned medicines)
    Description VARCHAR(255) NULL,
    Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (Admission_ID) REFERENCES Admission(Admission_ID),
    FOREIGN KEY (Station_ID) REFERENCES Enum_Department_Station(Station_ID),
    FOREIGN KEY (Item_ID) REFERENCES Charge_Catalog(Item_ID),
    FOREIGN KEY (Round_ID) REFERENCES Doctor_Round_Log(Round_ID),
    FOREIGN KEY (Transfer_ID) REFERENCES Room_Transfer_Log(Transfer_ID),
    FOREIGN KEY (Request_ID) REFERENCES Doctor_Order_Request(Request_ID)
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
