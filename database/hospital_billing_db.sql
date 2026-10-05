-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 05, 2026 at 06:55 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `hospital_billing_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `admission`
--

CREATE TABLE `admission` (
  `Admission_ID` int(11) NOT NULL,
  `Patient_ID` int(11) NOT NULL,
  `Chief_Complaint` varchar(500) NOT NULL,
  `Diagnosis` varchar(500) DEFAULT NULL,
  `Admission_Date` datetime DEFAULT current_timestamp(),
  `Status` varchar(20) DEFAULT 'Admitted'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `admission`
--

INSERT INTO `admission` (`Admission_ID`, `Patient_ID`, `Chief_Complaint`, `Diagnosis`, `Admission_Date`, `Status`) VALUES
(5, 7, 'High Fever, Dry Cough', 'Fever', '2026-09-26 18:51:23', 'Billed'),
(6, 5, 'High Temperature, Dry Coughs, Runny Nose.', 'COVID', '2026-09-28 00:05:45', 'Billed'),
(7, 1, 'Persistent fever and acute cough for 3 days', 'Community-Acquired Pneumonia (Moderate Risk)', '2026-09-28 19:06:54', 'Billed'),
(8, 2, 'Severe abdominal pain and fever', 'Acute Appendicitis', '2026-09-28 19:36:27', 'Billed'),
(9, 3, 'Headache, Hypertension', NULL, '2026-10-02 03:06:03', 'Billed'),
(10, 4, 'Internal Bleeding (Immediate Emergency Care).', 'Shrapnel Hit leading to Bleeding.', '2026-10-03 20:51:20', 'Billed'),
(12, 3, 'test', NULL, '2026-10-03 21:43:07', 'Billed'),
(13, 4, 'test1', NULL, '2026-10-05 02:34:31', 'Admitted'),
(14, 8, 'Headache, High Temperature', NULL, '2026-10-05 23:11:54', 'Discharged'),
(15, 9, 'Hypertension, Backpain', NULL, '2026-10-05 23:43:08', 'Billed'),
(16, 9, 'Hypertension, High Temperature', 'Fever', '2026-10-06 00:27:16', 'Billed');

-- --------------------------------------------------------

--
-- Table structure for table `admission_doctor`
--

CREATE TABLE `admission_doctor` (
  `Admission_Doctor_ID` int(11) NOT NULL,
  `Admission_ID` int(11) NOT NULL,
  `Doctor_ID` int(11) NOT NULL,
  `Assigned_Date` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `admission_doctor`
--

INSERT INTO `admission_doctor` (`Admission_Doctor_ID`, `Admission_ID`, `Doctor_ID`, `Assigned_Date`) VALUES
(6, 5, 3, '2026-09-26 18:51:23'),
(7, 5, 6, '2026-09-26 18:51:23'),
(8, 6, 3, '2026-09-28 00:05:45'),
(9, 6, 1, '2026-09-28 00:05:45'),
(10, 7, 1, '2026-09-28 19:06:54'),
(11, 7, 3, '2026-09-28 19:06:54'),
(12, 8, 1, '2026-09-28 19:36:27'),
(13, 8, 2, '2026-09-28 19:36:27'),
(14, 9, 3, '2026-10-02 03:06:03'),
(15, 9, 1, '2026-10-02 03:06:03'),
(16, 10, 3, '2026-10-03 20:51:20'),
(17, 10, 4, '2026-10-03 20:51:20'),
(19, 12, 3, '2026-10-03 21:43:07'),
(20, 12, 2, '2026-10-03 21:43:07'),
(21, 12, 6, '2026-10-03 21:43:07'),
(22, 12, 1, '2026-10-03 21:43:07'),
(23, 12, 4, '2026-10-03 21:43:07'),
(24, 13, 3, '2026-10-05 02:34:32'),
(25, 13, 2, '2026-10-05 02:34:32'),
(26, 14, 3, '2026-10-05 23:11:54'),
(27, 15, 3, '2026-10-05 23:43:08'),
(28, 15, 1, '2026-10-05 23:43:08'),
(29, 16, 3, '2026-10-06 00:27:16'),
(30, 16, 1, '2026-10-06 00:27:16');

-- --------------------------------------------------------

--
-- Table structure for table `audit_log`
--

CREATE TABLE `audit_log` (
  `Audit_ID` int(11) NOT NULL,
  `User_ID` int(11) DEFAULT NULL,
  `Admission_ID` int(11) DEFAULT NULL,
  `Module_ID` int(11) NOT NULL,
  `Action_ID` int(11) NOT NULL,
  `Record_Reference` varchar(60) DEFAULT '-',
  `Description` text NOT NULL,
  `Performed_By` varchar(100) DEFAULT 'System Admin',
  `Created_At` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `audit_log`
--

INSERT INTO `audit_log` (`Audit_ID`, `User_ID`, `Admission_ID`, `Module_ID`, `Action_ID`, `Record_Reference`, `Description`, `Performed_By`, `Created_At`) VALUES
(16, 1, NULL, 12, 10, 'PAT-1', 'Moved record to System Archive (patients: PAT-1)', 'System Admin', '2026-09-26 04:56:13'),
(17, 1, NULL, 12, 10, 'PAT-1', 'Moved record to System Archive (patients: PAT-1)', 'System Admin', '2026-09-26 04:57:45'),
(18, 1, NULL, 12, 11, 'PATIENTS-1', 'Restored archived patients (ID #1) back to active use', 'System Admin', '2026-09-26 15:49:46'),
(21, 1, NULL, 7, 2, 'PAT-NEW', 'Registered new patient: Elijah Villaluna', 'System Admin', '2026-09-26 18:46:32'),
(22, 1, NULL, 12, 10, 'PAT-7', 'Moved record to System Archive (patients: PAT-7)', 'System Admin', '2026-09-26 18:46:41'),
(23, 1, NULL, 12, 11, 'PATIENTS-7', 'Restored archived patients (ID #7) back to active use', 'System Admin', '2026-09-26 18:46:50'),
(24, 1, NULL, 8, 2, 'DOC-NEW', 'Registered new doctor: Dr. Juan Cruz', 'System Admin', '2026-09-26 18:47:49'),
(25, 1, NULL, 9, 2, 'Ward C', 'Added new hospital room: Ward C', 'System Admin', '2026-09-26 18:48:50'),
(26, 1, NULL, 12, 10, 'PAT-7', 'Moved record to System Archive (patients: PAT-7)', 'System Admin', '2026-09-26 18:55:50'),
(27, 1, NULL, 1, 1, '-', 'Executed operation: insertDepartment', 'System Admin', '2026-09-27 19:42:26'),
(28, 1, 6, 6, 14, 'INV-006', 'Settled invoice INV-006 for Net: ₱5,951.00, Tendered: ₱101.00, Balance: ₱5,850.00', 'System Admin', '2026-09-28 00:40:53'),
(29, 1, 6, 6, 15, 'INV-006', 'Received additional payment of ₱3,000.00 for INV-006. Applied: ₱3,000.00, Change: ₱0.00, Remaining: ₱2,850.00', 'System Admin', '2026-09-28 00:42:00'),
(30, 1, 6, 6, 15, 'INV-006', 'Received additional payment of ₱1,000.00 (OR-00003) for INV-006. Applied: ₱1,000.00, Change: ₱0.00, Remaining: ₱1,850.00', 'System Admin', '2026-09-28 01:04:36'),
(31, 1, 6, 6, 15, 'INV-006', 'Received additional payment of ₱1,850.00 (OR-00004) for INV-006. Applied: ₱1,850.00, Change: ₱0.00, Remaining: ₱0.00', 'System Admin', '2026-09-28 02:09:19'),
(32, 1, 7, 6, 14, 'INV-007', 'Settled invoice INV-007 for Net: ₱1,755.00, Tendered: ₱1,305.00, Balance: ₱450.00', 'System Admin', '2026-09-28 19:17:36'),
(33, 1, 7, 6, 15, 'INV-007', 'Received additional payment of ₱200.00 (OR-00006) for INV-007. Applied: ₱200.00, Change: ₱0.00, Remaining: ₱250.00', 'System Admin', '2026-09-30 17:17:03'),
(34, 1, 7, 6, 15, 'INV-007', 'Received additional payment of ₱250.00 (OR-00007) for INV-007. Applied: ₱250.00, Change: ₱0.00, Remaining: ₱0.00', 'System Admin', '2026-09-30 17:18:40'),
(35, 1, 8, 6, 14, 'INV-008', 'Settled invoice INV-008 for Net: ₱2,795.40, Tendered: ₱1,080.00, Balance: ₱1,715.40', 'System Admin', '2026-09-30 17:46:43'),
(36, 1, 8, 6, 15, 'INV-008', 'Received additional payment of ₱1,000.00 (OR-00009) for INV-008. Applied: ₱1,000.00, Change: ₱0.00, Remaining: ₱715.40', 'System Admin', '2026-09-30 17:47:37'),
(37, 1, 8, 6, 15, 'INV-008', 'Received additional payment of ₱715.40 (OR-00010) for INV-008. Applied: ₱715.40, Change: ₱0.00, Remaining: ₱0.00', 'System Admin', '2026-09-30 17:47:54'),
(38, 1, 9, 6, 16, 'OR-00011', 'Received advance deposit of ₱500.00 (Cash) for ADM-009. Remarks: Test Initial Deposit', 'System Admin', '2026-10-02 17:05:20'),
(39, 1, 9, 6, 14, 'INV-009', 'Settled invoice INV-009 for Net: ₱3,560.00, Advance Credited: ₱500.00, Tendered at Discharge: ₱2,060.00, Total Paid: ₱2,560.00, Balance: ₱1,000.00', 'System Admin', '2026-10-02 17:24:49'),
(40, 1, 9, 6, 15, 'INV-009', 'Received additional payment of ₱1,000.00 (OR-00013) for INV-009. Applied: ₱1,000.00, Change: ₱0.00, Remaining: ₱0.00', 'System Admin', '2026-10-03 20:45:41'),
(41, 1, 10, 6, 14, 'INV-010', 'Settled invoice INV-010 for Net: ₱10,215.00, Advance Credited: ₱0.00, Tendered at Discharge: ₱0.00, Total Paid: ₱0.00, Balance: ₱10,215.00', 'System Admin', '2026-10-03 21:04:31'),
(42, 1, 10, 6, 17, 'INV-010', 'Executed Promissory Note agreement for balance ₱10,215.00 (Next Due: 2026-11-03, Schedule: ₱1,702.50 for 6 mo(s)). Guarantor: Elias Magbanua', 'System Admin', '2026-10-03 21:04:31'),
(43, 1, 10, 6, 15, 'INV-010', 'Received additional payment of ₱1,702.50 (OR-00014) for INV-010. Applied: ₱1,702.50, Change: ₱0.00, Remaining: ₱8,512.50', 'System Admin', '2026-10-03 21:06:18'),
(44, 1, 10, 2, 5, 'ADM-010', 'Clinically discharged patient for Admission ADM-010 — Final Diagnosis: Recorded', 'System Admin', '2026-10-03 21:35:45'),
(48, 1, 12, 2, 3, 'ADM-012', 'Admitted patient ID #3 — Chief Complaint: test', 'System Admin', '2026-10-03 21:43:07'),
(49, 1, 12, 2, 5, 'ADM-012', 'Clinically discharged patient for Admission ADM-012 — Final Diagnosis: Recorded', 'System Admin', '2026-10-03 21:43:15'),
(50, 1, 12, 6, 14, 'INV-011', 'Settled invoice INV-011 for Net: ₱5,000.00, Advance Credited: ₱0.00, Tendered at Discharge: ₱5,000.00, Total Paid: ₱5,000.00, Balance: ₱0.00', 'System Admin', '2026-10-03 22:07:13'),
(51, 1, 12, 4, 8, 'INV-0011', 'Settled Final Invoice INV-0011 for Admission ADM-012', 'System Admin', '2026-10-03 22:07:13'),
(52, 1, 12, 6, 14, 'INV-012', 'Settled invoice INV-012 for Net: ₱5,000.00, Advance Credited: ₱0.00, Tendered at Discharge: ₱0.00, Total Paid: ₱0.00, Balance: ₱5,000.00', 'System Admin', '2026-10-03 22:53:29'),
(53, 1, 12, 6, 17, 'INV-012', 'Executed Promissory Note agreement for balance ₱5,000.00 (Next Due: 2026-11-02, Schedule: ₱1,666.67 for 3 mo(s)). Guarantor: Clara Luna', 'System Admin', '2026-10-03 22:53:29'),
(54, 1, 12, 4, 8, 'INV-0012', 'Settled Final Invoice INV-0012 for Admission ADM-012', 'System Admin', '2026-10-03 22:53:29'),
(55, 1, 12, 6, 15, 'INV-012', 'Received additional payment of ₱5,000.00 (OR-00015) for INV-012. Applied: ₱5,000.00, Change: ₱0.00, Remaining: ₱0.00', 'System Admin', '2026-10-04 18:55:46'),
(56, 1, 12, 1, 1, '-', 'Executed operation: recordPayment', 'System Admin', '2026-10-04 18:55:46'),
(57, 1, NULL, 13, 13, 'USR-001', 'User logged into active session: System Admin', 'System Admin', '2026-10-04 19:41:22'),
(58, 3, NULL, 13, 13, 'USR-003', 'User logged into active session: Jane Nurse', 'Jane Nurse', '2026-10-04 19:41:33'),
(59, 3, NULL, 13, 13, 'USR-003', 'User logged out of active session: Jane Nurse', 'Jane Nurse', '2026-10-04 19:41:33'),
(60, 3, NULL, 13, 13, 'USR-003', 'User logged into active session: Jane Nurse', 'Jane Nurse', '2026-10-04 19:56:23'),
(61, 3, NULL, 13, 13, 'USR-003', 'User logged out of active session: Jane Nurse', 'Jane Nurse', '2026-10-04 19:56:23'),
(62, 1, NULL, 13, 13, 'USR-001', 'User logged into active session: System Admin', 'System Admin', '2026-10-04 20:51:30'),
(63, 1, NULL, 13, 13, 'USR-001', 'User logged into active session: System Admin', 'System Admin', '2026-10-04 21:22:13'),
(64, 1, NULL, 1, 1, '-', 'Executed operation: insertDepartment', 'System Admin', '2026-10-04 23:10:40'),
(65, 1, NULL, 1, 1, '-', 'Executed operation: insertRoomType', 'System Admin', '2026-10-04 23:22:27'),
(66, 1, NULL, 1, 1, '-', 'Executed operation: removeRoomType', 'System Admin', '2026-10-04 23:22:48'),
(67, 1, NULL, 1, 1, '-', 'Executed operation: insertRoomType', 'System Admin', '2026-10-04 23:26:53'),
(68, 1, NULL, 9, 2, 'Emergency Room', 'Added new hospital room: Emergency Room', 'System Admin', '2026-10-04 23:30:03'),
(69, 1, NULL, 7, 1, 'PAT-001', 'Updated patient record: Juan Dela Cruz', 'System Admin', '2026-10-05 00:07:38'),
(70, 1, NULL, 7, 1, 'PAT-002', 'Updated patient record: Maria Santos', 'System Admin', '2026-10-05 00:07:52'),
(71, 1, NULL, 7, 1, 'PAT-003', 'Updated patient record: Antonio Luna', 'System Admin', '2026-10-05 00:08:05'),
(72, 1, NULL, 7, 1, 'PAT-004', 'Updated patient record: Teresa Magbanua', 'System Admin', '2026-10-05 00:08:16'),
(73, 1, NULL, 7, 1, 'PAT-005', 'Updated patient record: Emilio Aguinaldo', 'System Admin', '2026-10-05 00:08:25'),
(74, 1, NULL, 1, 1, '-', 'Executed operation: updateRoomType', 'System Admin', '2026-10-05 00:44:44'),
(75, 1, 13, 2, 3, 'ADM-013', 'Admitted patient ID #4 — Chief Complaint: test1', 'System Admin', '2026-10-05 02:34:32'),
(76, 1, NULL, 3, 6, 'ADM-000', 'Created & administered clinical order (Catalog ID #13, Qty: 1) for ADM-000', 'System Admin', '2026-10-05 02:41:44'),
(77, 1, NULL, 1, 1, '-', 'Executed operation: administerOrder', 'System Admin', '2026-10-05 02:41:49'),
(78, 1, NULL, 3, 6, 'ADM-000', 'Created & administered clinical order (Catalog ID #8, Qty: 10) for ADM-000', 'System Admin', '2026-10-05 02:42:09'),
(79, 1, NULL, 1, 1, '-', 'Executed operation: administerOrder', 'System Admin', '2026-10-05 02:42:12'),
(80, 1, NULL, 3, 7, 'ADM-000', 'Logged doctor round (Doctor ID #, Fee: PHP 1200) for ADM-000', 'System Admin', '2026-10-05 02:42:25'),
(81, 1, 13, 2, 4, 'ADM-013', 'Transferred patient to Bed ID #15 for Admission ADM-013', 'System Admin', '2026-10-05 02:42:48'),
(82, 1, NULL, 13, 13, 'USR-001', 'User logged into active session: System Admin', 'System Admin', '2026-10-05 12:34:16'),
(83, 1, NULL, 13, 13, 'USR-001', 'User logged into active session: System Admin', 'System Admin', '2026-10-05 14:56:24'),
(84, 1, NULL, 13, 13, 'USR-001', 'User logged into active session: System Admin', 'System Admin', '2026-10-05 20:45:01'),
(85, 1, NULL, 13, 13, 'USR-001', 'User logged into active session: System Admin', 'System Admin', '2026-10-05 21:29:18'),
(86, 1, NULL, 9, 1, 'WRD-C', 'Updated hospital room: WRD-C', 'System Admin', '2026-10-05 21:48:48'),
(87, 1, NULL, 9, 1, 'Ward C', 'Updated hospital room: Ward C', 'System Admin', '2026-10-05 21:49:34'),
(88, 1, NULL, 1, 1, '-', 'Executed operation: updateRoomType', 'System Admin', '2026-10-05 21:50:27'),
(89, 1, NULL, 9, 1, 'Ward C', 'Updated hospital room: Ward C', 'System Admin', '2026-10-05 21:50:31'),
(90, 1, NULL, 9, 1, 'Ward C', 'Updated hospital room: Ward C', 'System Admin', '2026-10-05 21:51:19'),
(91, 1, NULL, 9, 1, 'Ward C', 'Updated hospital room: Ward C', 'System Admin', '2026-10-05 21:51:27'),
(92, 1, NULL, 9, 1, 'Ward B', 'Updated hospital room: Ward B', 'System Admin', '2026-10-05 21:51:44'),
(93, 1, NULL, 1, 1, '-', 'Executed operation: updateRoomType', 'System Admin', '2026-10-05 21:51:53'),
(94, 1, NULL, 9, 1, 'Ward B', 'Updated hospital room: Ward B', 'System Admin', '2026-10-05 21:51:56'),
(95, 1, NULL, 12, 10, 'ROO-2', 'Moved record to System Archive (rooms: ROO-2)', 'System Admin', '2026-10-05 22:27:27'),
(96, 1, NULL, 12, 11, 'ROOMS-2', 'Restored archived rooms (ID #2) back to active use', 'System Admin', '2026-10-05 22:27:39'),
(97, 1, 10, 6, 14, 'INV-013', 'Settled invoice INV-013 for Net: ₱12,015.00, Advance Credited: ₱0.00, Tendered at Discharge: ₱12,015.00, Total Paid: ₱12,015.00, Balance: ₱0.00', 'System Admin', '2026-10-05 23:01:38'),
(98, 1, 10, 4, 8, 'INV-0013', 'Settled Final Invoice INV-0013 for Admission ADM-010', 'System Admin', '2026-10-05 23:01:38'),
(99, 1, 10, 6, 15, 'INV-010', 'Received additional payment of ₱8,512.50 (OR-00017) for INV-010. Applied: ₱8,512.50, Change: ₱0.00, Remaining: ₱0.00', 'System Admin', '2026-10-05 23:02:33'),
(100, 1, 10, 1, 1, '-', 'Executed operation: recordPayment', 'System Admin', '2026-10-05 23:02:33'),
(101, 1, NULL, 13, 13, 'USR-001', 'User logged out of active session: System Admin', 'System Admin', '2026-10-05 23:05:32'),
(102, 1, NULL, 13, 13, 'USR-001', 'User logged into active session: System Admin', 'System Admin', '2026-10-05 23:09:13'),
(103, 1, NULL, 7, 2, 'PAT-NEW', 'Registered new patient: Elijah Paul Villaluna', 'System Admin', '2026-10-05 23:10:46'),
(104, 1, 14, 2, 3, 'ADM-014', 'Admitted patient ID #8 — Chief Complaint: Headache, High Temperature', 'System Admin', '2026-10-05 23:11:54'),
(105, 1, NULL, 3, 6, 'ADM-000', 'Created & administered clinical order (Catalog ID #1, Qty: 5) for ADM-000', 'System Admin', '2026-10-05 23:12:49'),
(106, 1, NULL, 1, 1, '-', 'Executed operation: administerOrder', 'System Admin', '2026-10-05 23:13:07'),
(107, 1, NULL, 3, 6, 'ADM-000', 'Created & administered clinical order (Catalog ID #17, Qty: 1) for ADM-000', 'System Admin', '2026-10-05 23:13:29'),
(108, 1, NULL, 1, 1, '-', 'Executed operation: administerOrder', 'System Admin', '2026-10-05 23:13:32'),
(109, 1, 14, 2, 4, 'ADM-014', 'Transferred patient to Bed ID #1 for Admission ADM-014', 'System Admin', '2026-10-05 23:14:05'),
(110, 1, NULL, 3, 7, 'ADM-000', 'Logged doctor round (Doctor ID #, Fee: PHP 800) for ADM-000', 'System Admin', '2026-10-05 23:14:56'),
(111, 1, NULL, 13, 13, 'USR-001', 'User logged into active session: System Admin', 'System Admin', '2026-10-05 23:28:20'),
(112, 1, NULL, 13, 13, 'USR-001', 'User logged into active session: System Admin', 'System Admin', '2026-10-05 23:31:19'),
(113, 1, NULL, 13, 13, 'USR-001', 'User logged out of active session: System Admin', 'System Admin', '2026-10-05 23:39:01'),
(114, 1, NULL, 13, 13, 'USR-001', 'User logged into active session: System Admin', 'System Admin', '2026-10-05 23:39:30'),
(115, 1, NULL, 7, 2, 'PAT-NEW', 'Registered new patient: Juan Dela Cruz', 'System Admin', '2026-10-05 23:41:37'),
(116, 1, 15, 2, 3, 'ADM-015', 'Admitted patient ID #9 — Chief Complaint: Hypertension, Backpain', 'System Admin', '2026-10-05 23:43:08'),
(117, 1, NULL, 3, 6, 'ADM-000', 'Created & administered clinical order (Catalog ID #17, Qty: 1) for ADM-000', 'System Admin', '2026-10-05 23:43:52'),
(118, 1, NULL, 1, 1, '-', 'Executed operation: administerOrder', 'System Admin', '2026-10-05 23:43:57'),
(119, 1, NULL, 3, 6, 'ADM-000', 'Created & administered clinical order (Catalog ID #7, Qty: 10) for ADM-000', 'System Admin', '2026-10-05 23:44:13'),
(120, 1, NULL, 1, 1, '-', 'Executed operation: administerOrder', 'System Admin', '2026-10-05 23:44:16'),
(121, 1, 15, 2, 4, 'ADM-015', 'Transferred patient to Bed ID #3 for Admission ADM-015', 'System Admin', '2026-10-05 23:44:52'),
(122, 1, NULL, 3, 7, 'ADM-000', 'Logged doctor round (Doctor ID #, Fee: PHP 800) for ADM-000', 'System Admin', '2026-10-05 23:45:11'),
(123, 1, 15, 5, 9, 'ADM-015', 'Processed pharmacy medicine return (Qty: 1) for Admission ADM-015', 'System Admin', '2026-10-05 23:46:43'),
(124, 1, 15, 6, 16, 'OR-00018', 'Received advance deposit of ₱525.00 (Accounts Receivable (AR)) for ADM-015. Remarks: Advance Patient Deposit', 'System Admin', '2026-10-05 23:48:02'),
(125, 1, 15, 1, 1, '-', 'Executed operation: recordAdvancePayment', 'System Admin', '2026-10-05 23:48:02'),
(126, 1, 15, 6, 16, 'OR-00019', 'Received advance deposit of ₱525.00 (Cash) for ADM-015. Remarks: Advance Patient Deposit', 'System Admin', '2026-10-05 23:49:07'),
(127, 1, 15, 1, 1, '-', 'Executed operation: recordAdvancePayment', 'System Admin', '2026-10-05 23:49:07'),
(128, 1, 15, 2, 5, 'ADM-015', 'Clinically discharged patient for Admission ADM-015 — Final Diagnosis: Recorded', 'System Admin', '2026-10-05 23:51:07'),
(129, 1, 15, 6, 14, 'INV-014', 'Settled invoice INV-014 for Net: ₱1,550.00, Advance Credited: ₱1,050.00, Tendered at Discharge: ₱500.00, Total Paid: ₱1,550.00, Balance: ₱0.00', 'System Admin', '2026-10-05 23:52:21'),
(130, 1, 15, 4, 8, 'INV-0014', 'Settled Final Invoice INV-0014 for Admission ADM-015', 'System Admin', '2026-10-05 23:52:21'),
(131, 1, 14, 6, 16, 'OR-00021', 'Received advance deposit of ₱1,500.00 (Cash) for ADM-014. Remarks: Advance Patient Deposit', 'System Admin', '2026-10-05 23:54:42'),
(132, 1, 14, 1, 1, '-', 'Executed operation: recordAdvancePayment', 'System Admin', '2026-10-05 23:54:42'),
(133, 1, NULL, 13, 13, 'USR-001', 'User logged out of active session: System Admin', 'System Admin', '2026-10-06 00:24:58'),
(134, 1, NULL, 13, 13, 'USR-001', 'User logged into active session: System Admin', 'System Admin', '2026-10-06 00:25:16'),
(135, 1, 16, 2, 3, 'ADM-016', 'Admitted patient ID #9 — Chief Complaint: Hypertension, High Temperature', 'System Admin', '2026-10-06 00:27:16'),
(136, 1, NULL, 3, 6, 'ADM-000', 'Created & administered clinical order (Catalog ID #17, Qty: 1) for ADM-000', 'System Admin', '2026-10-06 00:27:57'),
(137, 1, NULL, 1, 1, '-', 'Executed operation: administerOrder', 'System Admin', '2026-10-06 00:28:03'),
(138, 1, NULL, 3, 6, 'ADM-000', 'Created & administered clinical order (Catalog ID #1, Qty: 10) for ADM-000', 'System Admin', '2026-10-06 00:28:16'),
(139, 1, NULL, 1, 1, '-', 'Executed operation: administerOrder', 'System Admin', '2026-10-06 00:28:20'),
(140, 1, NULL, 3, 6, 'ADM-000', 'Created & administered clinical order (Catalog ID #11, Qty: 1) for ADM-000', 'System Admin', '2026-10-06 00:28:39'),
(141, 1, NULL, 1, 1, '-', 'Executed operation: administerOrder', 'System Admin', '2026-10-06 00:28:42'),
(142, 1, 16, 2, 4, 'ADM-016', 'Transferred patient to Bed ID #18 for Admission ADM-016', 'System Admin', '2026-10-06 00:29:13'),
(143, 1, NULL, 3, 7, 'ADM-000', 'Logged doctor round (Doctor ID #, Fee: PHP 1500) for ADM-000', 'System Admin', '2026-10-06 00:30:12'),
(144, 1, NULL, 3, 7, 'ADM-000', 'Logged doctor round (Doctor ID #, Fee: PHP 800) for ADM-000', 'System Admin', '2026-10-06 00:30:22'),
(145, 1, 16, 5, 9, 'ADM-016', 'Processed pharmacy medicine return (Qty: 1) for Admission ADM-016', 'System Admin', '2026-10-06 00:31:33'),
(146, 1, 16, 6, 16, 'OR-00022', 'Received advance deposit of ₱1,000.00 (Cash) for ADM-016. Remarks: Advance Patient Deposit', 'System Admin', '2026-10-06 00:32:04'),
(147, 1, 16, 1, 1, '-', 'Executed operation: recordAdvancePayment', 'System Admin', '2026-10-06 00:32:04'),
(148, 1, 16, 2, 1, 'ADM-016', 'Updated clinical Diagnosis for Admission ADM-016: Fever', 'System Admin', '2026-10-06 00:32:49'),
(149, 1, 16, 2, 5, 'ADM-016', 'Clinically discharged patient for Admission ADM-016 — Final Diagnosis: Recorded', 'System Admin', '2026-10-06 00:34:07'),
(150, 1, 16, 6, 14, 'INV-015', 'Settled invoice INV-015 for Net: ₱5,224.50, Advance Credited: ₱1,000.00, Tendered at Discharge: ₱4,224.50, Total Paid: ₱5,224.50, Balance: ₱0.00', 'System Admin', '2026-10-06 00:37:14'),
(151, 1, 16, 4, 8, 'INV-0015', 'Settled Final Invoice INV-0015 for Admission ADM-016', 'System Admin', '2026-10-06 00:37:14'),
(152, 1, 14, 2, 5, 'ADM-014', 'Clinically discharged patient for Admission ADM-014 — Final Diagnosis: Recorded', 'System Admin', '2026-10-06 00:40:06');

-- --------------------------------------------------------

--
-- Table structure for table `billing_ledger`
--

CREATE TABLE `billing_ledger` (
  `Ledger_ID` int(11) NOT NULL,
  `Admission_ID` int(11) NOT NULL,
  `Station_ID` int(11) NOT NULL,
  `Catalog_ID` int(11) DEFAULT NULL,
  `Request_ID` int(11) DEFAULT NULL,
  `Round_ID` int(11) DEFAULT NULL,
  `Transfer_ID` int(11) DEFAULT NULL,
  `Quantity` decimal(8,2) NOT NULL,
  `Unit_Price` decimal(10,2) NOT NULL,
  `Total_Charge` decimal(12,2) NOT NULL,
  `Transaction_Type` varchar(20) DEFAULT 'Charge',
  `Timestamp` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `billing_ledger`
--

INSERT INTO `billing_ledger` (`Ledger_ID`, `Admission_ID`, `Station_ID`, `Catalog_ID`, `Request_ID`, `Round_ID`, `Transfer_ID`, `Quantity`, `Unit_Price`, `Total_Charge`, `Transaction_Type`, `Timestamp`) VALUES
(12, 5, 2, 14, 4, NULL, NULL, 1.00, 200.00, 200.00, 'Charge', '2026-09-26 18:52:02'),
(13, 5, 1, 1, 5, NULL, NULL, 5.00, 15.00, 75.00, 'Charge', '2026-09-26 18:52:40'),
(14, 5, 5, NULL, NULL, 3, NULL, 1.00, 800.00, 800.00, 'Charge', '2026-09-26 18:53:22'),
(15, 5, 3, NULL, NULL, 4, NULL, 1.00, 1200.00, 1200.00, 'Charge', '2026-09-26 18:53:30'),
(16, 5, 5, NULL, NULL, NULL, 6, 1.00, 500.00, 500.00, 'Charge', '2026-09-26 18:53:48'),
(17, 5, 1, 1, NULL, NULL, NULL, -3.00, 15.00, -45.00, 'Return', '2026-09-26 18:54:12'),
(18, 5, 5, NULL, NULL, NULL, 7, 1.00, 500.00, 500.00, 'Charge', '2026-09-26 18:54:33'),
(19, 6, 1, 1, 6, NULL, NULL, 5.00, 15.00, 75.00, 'Charge', '2026-09-28 00:07:43'),
(20, 6, 2, 14, 7, NULL, NULL, 1.00, 200.00, 200.00, 'Charge', '2026-09-28 00:07:46'),
(21, 6, 5, 17, 8, NULL, NULL, 1.00, 50.00, 50.00, 'Charge', '2026-09-28 00:07:48'),
(22, 6, 5, NULL, NULL, 5, NULL, 1.00, 800.00, 800.00, 'Charge', '2026-09-28 00:07:58'),
(23, 6, 3, NULL, NULL, 6, NULL, 1.00, 1500.00, 1500.00, 'Charge', '2026-09-28 00:08:04'),
(24, 6, 5, NULL, NULL, 7, NULL, 1.00, 800.00, 800.00, 'Charge', '2026-09-28 00:08:20'),
(25, 6, 5, NULL, NULL, NULL, 8, 1.00, 500.00, 500.00, 'Charge', '2026-09-28 00:08:37'),
(26, 6, 1, 5, 9, NULL, NULL, 5.00, 28.00, 140.00, 'Charge', '2026-09-28 00:09:48'),
(27, 6, 1, 5, NULL, NULL, NULL, -3.00, 28.00, -84.00, 'Return', '2026-09-28 00:11:16'),
(28, 6, 1, 1, NULL, NULL, NULL, -2.00, 15.00, -30.00, 'Return', '2026-09-28 00:11:26'),
(29, 6, 5, NULL, NULL, NULL, 9, 1.00, 2000.00, 2000.00, 'Charge', '2026-09-28 00:40:53'),
(30, 7, 3, NULL, NULL, 8, NULL, 1.00, 1200.00, 1200.00, 'Charge', '2026-09-28 19:07:57'),
(31, 7, 1, 2, 10, NULL, NULL, 10.00, 25.00, 250.00, 'Charge', '2026-09-28 19:08:36'),
(32, 7, 5, NULL, NULL, NULL, 10, 1.00, 500.00, 500.00, 'Charge', '2026-09-28 19:17:36'),
(33, 8, 1, 1, 11, NULL, NULL, 10.00, 15.00, 150.00, 'Charge', '2026-09-30 03:29:11'),
(34, 8, 1, 5, 12, NULL, NULL, 5.00, 28.00, 140.00, 'Charge', '2026-09-30 17:39:32'),
(35, 8, 2, NULL, NULL, 9, NULL, 1.00, 1200.00, 1200.00, 'Charge', '2026-09-30 17:39:48'),
(36, 8, 5, NULL, NULL, NULL, 12, 1.00, 500.00, 500.00, 'Charge', '2026-09-30 17:40:14'),
(37, 8, 1, 5, NULL, NULL, NULL, -3.00, 28.00, -84.00, 'Return', '2026-09-30 17:41:20'),
(38, 8, 5, NULL, NULL, NULL, 13, 1.00, 1200.00, 1200.00, 'Charge', '2026-09-30 17:43:13'),
(39, 9, 1, 1, 13, NULL, NULL, 10.00, 15.00, 150.00, 'Charge', '2026-10-02 15:22:42'),
(40, 9, 3, NULL, NULL, 10, NULL, 1.00, 1500.00, 1500.00, 'Charge', '2026-10-02 15:22:51'),
(41, 9, 5, 17, 15, NULL, NULL, 1.00, 50.00, 50.00, 'Charge', '2026-10-02 15:24:00'),
(42, 9, 1, 2, 14, NULL, NULL, 10.00, 25.00, 250.00, 'Charge', '2026-10-02 15:24:03'),
(43, 9, 5, NULL, NULL, 11, NULL, 1.00, 800.00, 800.00, 'Charge', '2026-10-02 15:24:28'),
(44, 9, 5, NULL, NULL, NULL, 14, 1.00, 2000.00, 2000.00, 'Charge', '2026-10-02 15:24:52'),
(45, 9, 5, NULL, NULL, NULL, 15, 1.00, 1200.00, 1200.00, 'Charge', '2026-10-02 17:09:51'),
(46, 10, 5, 17, 19, NULL, NULL, 1.00, 50.00, 50.00, 'Charge', '2026-10-03 20:53:21'),
(47, 10, 5, 21, 18, NULL, NULL, 1.00, 250.00, 250.00, 'Charge', '2026-10-03 20:53:24'),
(48, 10, 2, 11, 17, NULL, NULL, 1.00, 3500.00, 3500.00, 'Charge', '2026-10-03 20:53:27'),
(49, 10, 5, 16, 16, NULL, NULL, 1.00, 200.00, 200.00, 'Charge', '2026-10-03 20:53:29'),
(50, 10, 1, 8, 21, NULL, NULL, 10.00, 45.00, 450.00, 'Charge', '2026-10-03 20:54:23'),
(51, 10, 1, 3, 20, NULL, NULL, 10.00, 35.00, 350.00, 'Charge', '2026-10-03 20:54:25'),
(52, 10, 5, NULL, NULL, 12, NULL, 1.00, 800.00, 800.00, 'Charge', '2026-10-03 20:54:34'),
(53, 10, 5, NULL, NULL, 13, NULL, 1.00, 750.00, 750.00, 'Charge', '2026-10-03 20:54:38'),
(54, 10, 5, NULL, NULL, NULL, 16, 1.00, 5000.00, 5000.00, 'Charge', '2026-10-03 20:54:54'),
(55, 10, 5, NULL, NULL, NULL, 17, 1.00, 2000.00, 2000.00, 'Charge', '2026-10-03 21:01:36'),
(57, 12, 5, NULL, NULL, NULL, 19, 1.00, 5000.00, 5000.00, 'Charge', '2026-10-03 21:43:15'),
(58, 13, 2, 13, 22, NULL, NULL, 1.00, 2500.00, 2500.00, 'Charge', '2026-10-05 02:41:49'),
(59, 13, 1, 8, 23, NULL, NULL, 10.00, 45.00, 450.00, 'Charge', '2026-10-05 02:42:12'),
(60, 13, 2, NULL, NULL, 14, NULL, 1.00, 1200.00, 1200.00, 'Charge', '2026-10-05 02:42:25'),
(61, 13, 5, NULL, NULL, NULL, 20, 1.00, 100.00, 100.00, 'Charge', '2026-10-05 02:42:48'),
(62, 14, 1, 1, 24, NULL, NULL, 5.00, 15.00, 75.00, 'Charge', '2026-10-05 23:13:07'),
(63, 14, 5, 17, 25, NULL, NULL, 1.00, 50.00, 50.00, 'Charge', '2026-10-05 23:13:32'),
(64, 14, 5, NULL, NULL, NULL, 22, 1.00, 100.00, 100.00, 'Charge', '2026-10-05 23:14:05'),
(65, 14, 5, NULL, NULL, 15, NULL, 1.00, 800.00, 800.00, 'Charge', '2026-10-05 23:14:56'),
(66, 15, 5, 17, 26, NULL, NULL, 1.00, 50.00, 50.00, 'Charge', '2026-10-05 23:43:57'),
(67, 15, 1, 7, 27, NULL, NULL, 10.00, 20.00, 200.00, 'Charge', '2026-10-05 23:44:16'),
(68, 15, 5, NULL, NULL, NULL, 24, 1.00, 100.00, 100.00, 'Charge', '2026-10-05 23:44:52'),
(69, 15, 5, NULL, NULL, 16, NULL, 1.00, 800.00, 800.00, 'Charge', '2026-10-05 23:45:11'),
(70, 15, 1, 7, NULL, NULL, NULL, -5.00, 20.00, -100.00, 'Return', '2026-10-05 23:46:43'),
(71, 15, 5, NULL, NULL, NULL, 25, 1.00, 500.00, 500.00, 'Charge', '2026-10-05 23:51:07'),
(72, 16, 5, 17, 28, NULL, NULL, 1.00, 50.00, 50.00, 'Charge', '2026-10-06 00:28:03'),
(73, 16, 1, 1, 29, NULL, NULL, 10.00, 15.00, 150.00, 'Charge', '2026-10-06 00:28:20'),
(74, 16, 2, 11, 30, NULL, NULL, 1.00, 3500.00, 3500.00, 'Charge', '2026-10-06 00:28:42'),
(75, 16, 5, NULL, NULL, NULL, 26, 1.00, 100.00, 100.00, 'Charge', '2026-10-06 00:29:13'),
(76, 16, 3, NULL, NULL, 17, NULL, 1.00, 1500.00, 1500.00, 'Charge', '2026-10-06 00:30:12'),
(77, 16, 5, NULL, NULL, 18, NULL, 1.00, 800.00, 800.00, 'Charge', '2026-10-06 00:30:22'),
(78, 16, 1, 1, NULL, NULL, NULL, -3.00, 15.00, -45.00, 'Return', '2026-10-06 00:31:33'),
(79, 16, 5, NULL, NULL, NULL, 27, 1.00, 500.00, 500.00, 'Charge', '2026-10-06 00:34:07'),
(80, 14, 5, NULL, NULL, NULL, 23, 1.00, 500.00, 500.00, 'Charge', '2026-10-06 00:40:06');

-- --------------------------------------------------------

--
-- Table structure for table `charge_catalogs`
--

CREATE TABLE `charge_catalogs` (
  `Catalog_ID` int(11) NOT NULL,
  `Item_Name` varchar(150) NOT NULL,
  `Category_Type` varchar(50) NOT NULL,
  `Code_Prefix` varchar(10) NOT NULL,
  `Unit_Price` decimal(10,2) NOT NULL,
  `Is_Active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `charge_catalogs`
--

INSERT INTO `charge_catalogs` (`Catalog_ID`, `Item_Name`, `Category_Type`, `Code_Prefix`, `Unit_Price`, `Is_Active`) VALUES
(1, 'Paracetamol 500mg Tablet', 'Medicine', 'MED', 15.00, 1),
(2, 'Amoxicillin 500mg Capsule', 'Medicine', 'MED', 25.00, 1),
(3, 'Omeprazole 20mg Capsule', 'Medicine', 'MED', 35.00, 1),
(4, 'Metformin 500mg Tablet', 'Medicine', 'MED', 18.00, 1),
(5, 'Losartan 50mg Tablet', 'Medicine', 'MED', 28.00, 1),
(6, 'Cetirizine 10mg Tablet', 'Medicine', 'MED', 12.00, 1),
(7, 'Ibuprofen 400mg Tablet', 'Medicine', 'MED', 20.00, 1),
(8, 'Azithromycin 500mg Tablet', 'Medicine', 'MED', 45.00, 1),
(9, 'Chest X-Ray PA View', 'Equipment Scan', 'RAD', 500.00, 1),
(10, 'Abdominal Ultrasound', 'Equipment Scan', 'RAD', 900.00, 1),
(11, 'Head CT-Scan (Plain)', 'Equipment Scan', 'RAD', 3500.00, 1),
(12, '12-Lead Electrocardiogram (ECG)', 'Equipment Scan', 'RAD', 400.00, 1),
(13, '2D Echocardiogram with Doppler', 'Equipment Scan', 'RAD', 2500.00, 1),
(14, 'Complete Blood Count (CBC)', 'Equipment Scan', 'RAD', 200.00, 1),
(15, 'IV Cannulation & Line Insertion', 'Service', 'SRV', 150.00, 1),
(16, 'Wound Dressing & Cleaning', 'Service', 'SRV', 200.00, 1),
(17, 'Vital Signs Monitoring (Daily)', 'Service', 'SRV', 50.00, 1),
(18, 'Blood Extraction (Phlebotomy)', 'Service', 'SRV', 80.00, 1),
(19, 'Nebulization Therapy', 'Service', 'SRV', 120.00, 1),
(20, 'Physical Therapy Session', 'Service', 'SRV', 500.00, 1),
(21, 'Catheter Insertion', 'Service', 'SRV', 250.00, 1);

-- --------------------------------------------------------

--
-- Table structure for table `doctor`
--

CREATE TABLE `doctor` (
  `Doctor_ID` int(11) NOT NULL,
  `First_Name` varchar(50) NOT NULL,
  `Last_Name` varchar(50) NOT NULL,
  `Doctor_Type_ID` int(11) NOT NULL,
  `Station_ID` int(11) NOT NULL,
  `Code_Prefix` varchar(10) NOT NULL DEFAULT 'DOC',
  `Base_Round_Fee` decimal(10,2) NOT NULL,
  `Is_Active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `doctor`
--

INSERT INTO `doctor` (`Doctor_ID`, `First_Name`, `Last_Name`, `Doctor_Type_ID`, `Station_ID`, `Code_Prefix`, `Base_Round_Fee`, `Is_Active`) VALUES
(1, 'Maria', 'Santos', 2, 3, 'DOC', 1500.00, 1),
(2, 'Jose', 'Reyes', 2, 2, 'DOC', 1200.00, 1),
(3, 'Ana', 'Cruz', 1, 5, 'DOC', 800.00, 1),
(4, 'Pedro', 'Gomez', 1, 5, 'DOC', 750.00, 1),
(6, 'Juan', 'Cruz', 2, 3, 'DOC', 1200.00, 1);

-- --------------------------------------------------------

--
-- Table structure for table `doctor_order_request`
--

CREATE TABLE `doctor_order_request` (
  `Request_ID` int(11) NOT NULL,
  `Admission_Doctor_ID` int(11) NOT NULL,
  `Catalog_ID` int(11) NOT NULL,
  `Quantity` decimal(8,2) NOT NULL DEFAULT 1.00,
  `Status` varchar(20) DEFAULT 'Pending',
  `Request_Timestamp` datetime DEFAULT current_timestamp(),
  `Administered_Timestamp` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `doctor_order_request`
--

INSERT INTO `doctor_order_request` (`Request_ID`, `Admission_Doctor_ID`, `Catalog_ID`, `Quantity`, `Status`, `Request_Timestamp`, `Administered_Timestamp`) VALUES
(4, 6, 14, 1.00, 'Administered', '2026-09-26 18:51:51', '2026-09-26 18:52:02'),
(5, 7, 1, 5.00, 'Administered', '2026-09-26 18:52:35', '2026-09-26 18:52:40'),
(6, 8, 1, 5.00, 'Administered', '2026-09-28 00:06:39', '2026-09-28 00:07:43'),
(7, 9, 14, 1.00, 'Administered', '2026-09-28 00:06:49', '2026-09-28 00:07:46'),
(8, 8, 17, 1.00, 'Administered', '2026-09-28 00:07:32', '2026-09-28 00:07:48'),
(9, 9, 5, 5.00, 'Administered', '2026-09-28 00:09:45', '2026-09-28 00:09:48'),
(10, 10, 2, 10.00, 'Administered', '2026-09-28 19:07:57', '2026-09-28 19:08:36'),
(11, 13, 1, 10.00, 'Administered', '2026-09-30 03:28:59', '2026-09-30 03:29:11'),
(12, 12, 5, 5.00, 'Administered', '2026-09-30 17:39:04', '2026-09-30 17:39:32'),
(13, 15, 1, 10.00, 'Administered', '2026-10-02 15:22:37', '2026-10-02 15:22:42'),
(14, 14, 2, 10.00, 'Administered', '2026-10-02 15:23:26', '2026-10-02 15:24:03'),
(15, 15, 17, 1.00, 'Administered', '2026-10-02 15:23:52', '2026-10-02 15:24:00'),
(16, 17, 16, 1.00, 'Administered', '2026-10-03 20:52:13', '2026-10-03 20:53:29'),
(17, 17, 11, 1.00, 'Administered', '2026-10-03 20:52:23', '2026-10-03 20:53:27'),
(18, 17, 21, 1.00, 'Administered', '2026-10-03 20:53:01', '2026-10-03 20:53:24'),
(19, 16, 17, 1.00, 'Administered', '2026-10-03 20:53:18', '2026-10-03 20:53:21'),
(20, 16, 3, 10.00, 'Administered', '2026-10-03 20:53:53', '2026-10-03 20:54:25'),
(21, 16, 8, 10.00, 'Administered', '2026-10-03 20:54:20', '2026-10-03 20:54:23'),
(22, 24, 13, 1.00, 'Administered', '2026-10-05 02:41:44', '2026-10-05 02:41:49'),
(23, 24, 8, 10.00, 'Administered', '2026-10-05 02:42:09', '2026-10-05 02:42:12'),
(24, 26, 1, 5.00, 'Administered', '2026-10-05 23:12:49', '2026-10-05 23:13:07'),
(25, 26, 17, 1.00, 'Administered', '2026-10-05 23:13:29', '2026-10-05 23:13:31'),
(26, 28, 17, 1.00, 'Administered', '2026-10-05 23:43:52', '2026-10-05 23:43:57'),
(27, 28, 7, 10.00, 'Administered', '2026-10-05 23:44:13', '2026-10-05 23:44:16'),
(28, 29, 17, 1.00, 'Administered', '2026-10-06 00:27:57', '2026-10-06 00:28:03'),
(29, 30, 1, 10.00, 'Administered', '2026-10-06 00:28:16', '2026-10-06 00:28:20'),
(30, 29, 11, 1.00, 'Administered', '2026-10-06 00:28:39', '2026-10-06 00:28:42');

-- --------------------------------------------------------

--
-- Table structure for table `doctor_round_log`
--

CREATE TABLE `doctor_round_log` (
  `Round_ID` int(11) NOT NULL,
  `Admission_Doctor_ID` int(11) NOT NULL,
  `Round_Timestamp` datetime DEFAULT current_timestamp(),
  `Charged_Fee` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `doctor_round_log`
--

INSERT INTO `doctor_round_log` (`Round_ID`, `Admission_Doctor_ID`, `Round_Timestamp`, `Charged_Fee`) VALUES
(3, 6, '2026-09-26 18:53:22', 800.00),
(4, 7, '2026-09-26 18:53:30', 1200.00),
(5, 8, '2026-09-28 00:07:58', 800.00),
(6, 9, '2026-09-28 00:08:04', 1500.00),
(7, 8, '2026-09-28 00:08:20', 800.00),
(8, 10, '2026-09-28 19:07:57', 1200.00),
(9, 13, '2026-09-30 17:39:48', 1200.00),
(10, 15, '2026-10-02 15:22:51', 1500.00),
(11, 14, '2026-10-02 15:24:28', 800.00),
(12, 16, '2026-10-03 20:54:34', 800.00),
(13, 17, '2026-10-03 20:54:38', 750.00),
(14, 25, '2026-10-05 02:42:25', 1200.00),
(15, 26, '2026-10-05 23:14:56', 800.00),
(16, 27, '2026-10-05 23:45:11', 800.00),
(17, 30, '2026-10-06 00:30:12', 1500.00),
(18, 29, '2026-10-06 00:30:22', 800.00);

-- --------------------------------------------------------

--
-- Table structure for table `doctor_specialty`
--

CREATE TABLE `doctor_specialty` (
  `Doctor_Specialty_ID` int(11) NOT NULL,
  `Doctor_ID` int(11) NOT NULL,
  `Specialty_ID` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `doctor_specialty`
--

INSERT INTO `doctor_specialty` (`Doctor_Specialty_ID`, `Doctor_ID`, `Specialty_ID`) VALUES
(1, 1, 1),
(2, 1, 2),
(3, 2, 3),
(4, 3, 1),
(5, 3, 6),
(6, 4, 4),
(9, 6, 2),
(10, 6, 7);

-- --------------------------------------------------------

--
-- Table structure for table `enum_audit_action`
--

CREATE TABLE `enum_audit_action` (
  `Action_ID` int(11) NOT NULL,
  `Action_Type` varchar(50) NOT NULL,
  `Badge_Class` varchar(50) DEFAULT 'badge-secondary',
  `Is_Active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `enum_audit_action`
--

INSERT INTO `enum_audit_action` (`Action_ID`, `Action_Type`, `Badge_Class`, `Is_Active`) VALUES
(1, 'UPDATE', 'badge-warning', 1),
(2, 'CREATE', 'badge-success', 1),
(3, 'ADMIT', 'badge-success', 1),
(4, 'TRANSFER', 'badge-warning', 1),
(5, 'DISCHARGE', 'badge-warning', 1),
(6, 'ORDER', 'badge-primary', 1),
(7, 'ROUND', 'badge-primary', 1),
(8, 'BILLING', 'badge-primary', 1),
(9, 'RETURN', 'badge-danger', 1),
(10, 'ARCHIVE', 'badge-warning', 1),
(11, 'RESTORE', 'badge-success', 1),
(12, 'DELETE', 'badge-danger', 1),
(13, 'AUTH', 'badge-primary', 1),
(14, 'Billing Settled', 'badge-success', 1),
(15, 'Payment Received', 'badge-success', 1),
(16, 'Advance Payment Recorded', 'badge-success', 1),
(17, 'Promissory Note Executed', 'badge-warning', 1);

-- --------------------------------------------------------

--
-- Table structure for table `enum_audit_module`
--

CREATE TABLE `enum_audit_module` (
  `Module_ID` int(11) NOT NULL,
  `Module_Name` varchar(60) NOT NULL,
  `Module_Code` varchar(30) DEFAULT NULL,
  `Is_Active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `enum_audit_module`
--

INSERT INTO `enum_audit_module` (`Module_ID`, `Module_Name`, `Module_Code`, `Is_Active`) VALUES
(1, 'System', 'SYS', 1),
(2, 'Admissions & Beds', 'ADM_BED', 1),
(3, 'Clinical Orders', 'CLIN_ORD', 1),
(4, 'Billing & Settlement', 'BIL_SETTLE', 1),
(5, 'Billing & Ledger', 'BIL_LEDGER', 1),
(6, 'Billing', 'BIL', 1),
(7, 'Patients Directory', 'PAT_DIR', 1),
(8, 'Doctors & Fees', 'DOC_FEE', 1),
(9, 'Rooms & Beds', 'ROOM_BED', 1),
(10, 'Charge Catalogs', 'CATALOG', 1),
(11, 'Billing Discounts', 'DISCOUNT', 1),
(12, 'System Archive', 'ARCHIVE', 1),
(13, 'Authentication', 'AUTH', 1);

-- --------------------------------------------------------

--
-- Table structure for table `enum_blood_type`
--

CREATE TABLE `enum_blood_type` (
  `Blood_Type_ID` int(11) NOT NULL,
  `Blood_Type_Name` varchar(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `enum_blood_type`
--

INSERT INTO `enum_blood_type` (`Blood_Type_ID`, `Blood_Type_Name`) VALUES
(1, 'A+'),
(2, 'A-'),
(3, 'B+'),
(4, 'B-'),
(5, 'AB+'),
(6, 'AB-'),
(7, 'O+'),
(8, 'O-');

-- --------------------------------------------------------

--
-- Table structure for table `enum_department_station`
--

CREATE TABLE `enum_department_station` (
  `Station_ID` int(11) NOT NULL,
  `Station_Name` varchar(50) NOT NULL,
  `Code_Prefix` varchar(10) NOT NULL,
  `Is_Active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `enum_department_station`
--

INSERT INTO `enum_department_station` (`Station_ID`, `Station_Name`, `Code_Prefix`, `Is_Active`) VALUES
(1, 'Central Pharmacy', 'PHARM', 1),
(2, 'Radiology & Imaging', 'RAD', 1),
(3, 'Cardiology Station', 'CARD', 1),
(4, 'Laboratory', 'LAB', 1),
(5, 'Nurse Station', 'NRS', 1),
(6, 'Physical Therapy & Rehab', 'PT', 1),
(7, 'Billing & Cashier', 'BLG', 1),
(8, 'Neurology Department', 'NEURO', 1),
(9, 'Emergency Department', 'ER', 1);

-- --------------------------------------------------------

--
-- Table structure for table `enum_discount`
--

CREATE TABLE `enum_discount` (
  `Discount_ID` int(11) NOT NULL,
  `Discount_Name` varchar(50) NOT NULL,
  `Discount_Type_ID` int(11) NOT NULL DEFAULT 1,
  `Discount_Percentage` decimal(5,2) NOT NULL,
  `Fixed_Amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `Is_Active` tinyint(1) DEFAULT 1,
  `Is_Vat_Exempt` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `enum_discount`
--

INSERT INTO `enum_discount` (`Discount_ID`, `Discount_Name`, `Discount_Type_ID`, `Discount_Percentage`, `Fixed_Amount`, `Is_Active`, `Is_Vat_Exempt`) VALUES
(1, 'Senior Citizen', 1, 20.00, 0.00, 1, 1),
(2, 'Person with Disability (PWD)', 1, 20.00, 0.00, 1, 1),
(3, 'Government Employee', 1, 10.00, 0.00, 1, 0),
(5, 'Malasakit', 2, 0.00, 1000.00, 0, 0),
(6, 'PCSO', 2, 0.00, 500.00, 0, 0),
(7, 'DSWD', 2, 0.00, 250.00, 1, 0);

-- --------------------------------------------------------

--
-- Table structure for table `enum_discount_type`
--

CREATE TABLE `enum_discount_type` (
  `Discount_Type_ID` int(11) NOT NULL,
  `Type_Name` varchar(50) NOT NULL,
  `Code_Prefix` varchar(10) NOT NULL DEFAULT 'DISC',
  `Is_Active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `enum_discount_type`
--

INSERT INTO `enum_discount_type` (`Discount_Type_ID`, `Type_Name`, `Code_Prefix`, `Is_Active`) VALUES
(1, 'Percentage', 'PCT', 1),
(2, 'Fixed', 'FIX', 1);

-- --------------------------------------------------------

--
-- Table structure for table `enum_doctor_type`
--

CREATE TABLE `enum_doctor_type` (
  `Doctor_Type_ID` int(11) NOT NULL,
  `Type_Name` varchar(50) NOT NULL,
  `Is_Active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `enum_doctor_type`
--

INSERT INTO `enum_doctor_type` (`Doctor_Type_ID`, `Type_Name`, `Is_Active`) VALUES
(1, 'Resident', 1),
(2, 'Attending', 1);

-- --------------------------------------------------------

--
-- Table structure for table `enum_gender`
--

CREATE TABLE `enum_gender` (
  `Gender_ID` int(11) NOT NULL,
  `Gender_Name` varchar(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `enum_gender`
--

INSERT INTO `enum_gender` (`Gender_ID`, `Gender_Name`) VALUES
(1, 'Male'),
(2, 'Female'),
(3, 'Other');

-- --------------------------------------------------------

--
-- Table structure for table `enum_payment_method`
--

CREATE TABLE `enum_payment_method` (
  `Payment_Method_ID` int(11) NOT NULL,
  `Method_Name` varchar(100) NOT NULL,
  `Category_Type` varchar(50) NOT NULL DEFAULT 'Standard',
  `Code_Prefix` varchar(10) NOT NULL DEFAULT 'PM',
  `Description` varchar(255) DEFAULT NULL,
  `Is_Active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `enum_payment_method`
--

INSERT INTO `enum_payment_method` (`Payment_Method_ID`, `Method_Name`, `Category_Type`, `Code_Prefix`, `Description`, `Is_Active`) VALUES
(1, 'Cash', 'Cash', 'CSH', 'Cash Tendered at Cashier Counter', 1),
(2, 'Accounts Receivable (AR)', 'Receivable', 'AR', 'Promissory Note / Hospital Accounts Receivable', 1),
(3, 'Notes Receivable', 'Receivable', 'NR', 'Formal Promissory Note with Due Date', 1),
(4, 'GCash', 'Digital / E-Wallet', 'GCSH', 'GCash Mobile Wallet Transfer', 1),
(5, 'PayMaya (Maya)', 'Digital / E-Wallet', 'MAYA', 'Maya Mobile Wallet Transfer', 1),
(6, 'Bank Transfer', 'Bank', 'BANK', 'Direct Online Bank Transfer / Deposit', 1),
(7, 'Credit / Debit Card', 'Card', 'CARD', 'POS Terminal Credit or Debit Card', 1),
(8, 'Check / Cheque', 'Check', 'CHK', 'Bank Manager or Company Cheque', 1);

-- --------------------------------------------------------

--
-- Table structure for table `enum_promissory_plan_type`
--

CREATE TABLE `enum_promissory_plan_type` (
  `Plan_Type_ID` int(11) NOT NULL,
  `Plan_Type_Code` varchar(30) NOT NULL,
  `Plan_Type_Name` varchar(100) NOT NULL,
  `Default_Months` int(11) NOT NULL DEFAULT 1,
  `Description` varchar(255) DEFAULT NULL,
  `Is_Active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `enum_promissory_plan_type`
--

INSERT INTO `enum_promissory_plan_type` (`Plan_Type_ID`, `Plan_Type_Code`, `Plan_Type_Name`, `Default_Months`, `Description`, `Is_Active`) VALUES
(1, 'Full_30_Days', 'Full Settlement (Within 30 Days)', 1, 'One-time lump sum payment within 30 days from discharge', 1),
(2, 'Monthly_Installment', 'Monthly Installment Plan', 3, 'Structured equal monthly installment payments', 1);

-- --------------------------------------------------------

--
-- Table structure for table `enum_room_type`
--

CREATE TABLE `enum_room_type` (
  `Room_Type_ID` int(11) NOT NULL,
  `Type_Name` varchar(50) NOT NULL,
  `Code_Prefix` varchar(10) NOT NULL,
  `Daily_Rate` decimal(10,2) NOT NULL,
  `Is_Active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `enum_room_type`
--

INSERT INTO `enum_room_type` (`Room_Type_ID`, `Type_Name`, `Code_Prefix`, `Daily_Rate`, `Is_Active`) VALUES
(1, 'Ward', 'WRD', 500.00, 1),
(2, 'Semi-Private Room', 'SPVT', 1200.00, 1),
(3, 'Private Room', 'PVT', 2000.00, 1),
(4, 'Intensive Care Unit (ICU)', 'ICU', 5000.00, 1),
(5, 'Emergency Room', 'ER', 100.00, 1);

-- --------------------------------------------------------

--
-- Table structure for table `enum_specialty`
--

CREATE TABLE `enum_specialty` (
  `Specialty_ID` int(11) NOT NULL,
  `Specialty_Name` varchar(100) NOT NULL,
  `Is_Active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `enum_specialty`
--

INSERT INTO `enum_specialty` (`Specialty_ID`, `Specialty_Name`, `Is_Active`) VALUES
(1, 'Internal Medicine', 1),
(2, 'Cardiology', 1),
(3, 'Radiology & Diagnostic Imaging', 1),
(4, 'General Surgery', 1),
(5, 'Pediatrics', 1),
(6, 'Pulmonology', 1),
(7, 'Orthopedics', 1),
(9, 'Oncology', 1);

-- --------------------------------------------------------

--
-- Table structure for table `enum_user_role`
--

CREATE TABLE `enum_user_role` (
  `Role_ID` int(11) NOT NULL,
  `Role_Name` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `enum_user_role`
--

INSERT INTO `enum_user_role` (`Role_ID`, `Role_Name`) VALUES
(1, 'Admin'),
(2, 'Finance Staff'),
(3, 'Nurse');

-- --------------------------------------------------------

--
-- Table structure for table `final_invoice`
--

CREATE TABLE `final_invoice` (
  `Invoice_ID` int(11) NOT NULL,
  `Admission_ID` int(11) NOT NULL,
  `Processed_By_User_ID` int(11) NOT NULL,
  `Discount_ID` int(11) DEFAULT NULL,
  `Gross_Total` decimal(12,2) NOT NULL,
  `Discount_Amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `Advance_Payment_Amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `VAT_Rate` decimal(5,2) NOT NULL DEFAULT 12.00,
  `VATable_Amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `VAT_Amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `VAT_Exempt_Amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `Discount_Summary` varchar(255) DEFAULT NULL,
  `Net_Amount_Due` decimal(12,2) NOT NULL,
  `Amount_Paid` decimal(12,2) NOT NULL DEFAULT 0.00,
  `Change_Amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `Settlement_Date` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `final_invoice`
--

INSERT INTO `final_invoice` (`Invoice_ID`, `Admission_ID`, `Processed_By_User_ID`, `Discount_ID`, `Gross_Total`, `Discount_Amount`, `Advance_Payment_Amount`, `VAT_Rate`, `VATable_Amount`, `VAT_Amount`, `VAT_Exempt_Amount`, `Discount_Summary`, `Net_Amount_Due`, `Amount_Paid`, `Change_Amount`, `Settlement_Date`) VALUES
(5, 5, 1, 2, 3230.00, 646.00, 0.00, 12.00, 0.00, 0.00, 0.00, NULL, 2584.00, 2584.00, 0.00, '2026-09-26 18:54:33'),
(6, 6, 1, NULL, 5951.00, 0.00, 0.00, 12.00, 0.00, 0.00, 0.00, NULL, 5951.00, 5951.00, 0.00, '2026-09-28 00:40:53'),
(7, 7, 1, 3, 1950.00, 195.00, 0.00, 12.00, 0.00, 0.00, 0.00, NULL, 1755.00, 1755.00, 0.00, '2026-09-28 19:17:36'),
(8, 8, 1, 3, 3106.00, 310.60, 0.00, 12.00, 0.00, 0.00, 0.00, NULL, 2795.40, 2795.40, 0.00, '2026-09-30 17:46:42'),
(9, 9, 1, 5, 5950.00, 2390.00, 500.00, 0.00, 0.00, 0.00, 3560.00, 'Malasakit (-₱1,000.00)<br>PCSO (-₱500.00)<br>Senior Citizen 20.00% (-₱890.00)', 3560.00, 3560.00, 0.00, '2026-10-02 17:24:49'),
(10, 10, 1, 5, 13350.00, 3135.00, 0.00, 12.00, 8989.20, 1225.80, 0.00, 'Malasakit (-₱2,000.00)<br>Government Employee 10.00% (-₱1,135.00)', 10215.00, 10215.00, 0.00, '2026-10-03 21:04:31'),
(12, 12, 1, NULL, 5000.00, 0.00, 0.00, 12.00, 4400.00, 600.00, 0.00, NULL, 5000.00, 5000.00, 0.00, '2026-10-03 22:53:29'),
(13, 10, 1, 3, 13350.00, 1335.00, 0.00, 12.00, 10573.20, 1441.80, 0.00, 'Government Employee 10.00% (-₱1,335.00)', 12015.00, 12015.00, 0.00, '2026-10-05 23:01:38'),
(14, 15, 1, NULL, 1550.00, 0.00, 1050.00, 12.00, 1364.00, 186.00, 0.00, NULL, 1550.00, 1550.00, 0.00, '2026-10-05 23:52:21'),
(15, 16, 1, 5, 6555.00, 1330.50, 1000.00, 12.00, 4597.56, 626.94, 0.00, 'Malasakit (-₱500.00)<br>DSWD (-₱250.00)<br>Government Employee 10.00% (-₱580.50)', 5224.50, 5224.50, 0.00, '2026-10-06 00:37:14');

-- --------------------------------------------------------

--
-- Table structure for table `invoice_applied_discount`
--

CREATE TABLE `invoice_applied_discount` (
  `Applied_Discount_ID` int(11) NOT NULL,
  `Invoice_ID` int(11) NOT NULL,
  `Discount_ID` int(11) NOT NULL,
  `Discount_Name` varchar(100) NOT NULL,
  `Discount_Value` decimal(12,2) NOT NULL DEFAULT 0.00,
  `Calculated_Deduction` decimal(12,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `invoice_applied_discount`
--

INSERT INTO `invoice_applied_discount` (`Applied_Discount_ID`, `Invoice_ID`, `Discount_ID`, `Discount_Name`, `Discount_Value`, `Calculated_Deduction`) VALUES
(1, 9, 5, 'Malasakit', 1000.00, 1000.00),
(2, 9, 6, 'PCSO', 500.00, 500.00),
(3, 9, 1, 'Senior Citizen', 20.00, 890.00),
(4, 10, 5, 'Malasakit', 2000.00, 2000.00),
(5, 10, 3, 'Government Employee', 10.00, 1135.00),
(6, 13, 3, 'Government Employee', 10.00, 1335.00),
(7, 15, 5, 'Malasakit', 500.00, 500.00),
(8, 15, 7, 'DSWD', 250.00, 250.00),
(9, 15, 3, 'Government Employee', 10.00, 580.50);

-- --------------------------------------------------------

--
-- Table structure for table `invoice_payment`
--

CREATE TABLE `invoice_payment` (
  `Payment_ID` int(11) NOT NULL,
  `Invoice_ID` int(11) DEFAULT NULL,
  `Admission_ID` int(11) NOT NULL,
  `Cashier_User_ID` int(11) NOT NULL,
  `Receipt_Number` varchar(30) NOT NULL,
  `Amount_Paid` decimal(12,2) NOT NULL,
  `Balance_Before` decimal(12,2) NOT NULL,
  `Balance_After` decimal(12,2) NOT NULL,
  `Payment_Method_ID` int(11) NOT NULL DEFAULT 1,
  `Notes` varchar(255) DEFAULT NULL,
  `Is_Advance` tinyint(1) DEFAULT 0,
  `Payment_Date` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `invoice_payment`
--

INSERT INTO `invoice_payment` (`Payment_ID`, `Invoice_ID`, `Admission_ID`, `Cashier_User_ID`, `Receipt_Number`, `Amount_Paid`, `Balance_Before`, `Balance_After`, `Payment_Method_ID`, `Notes`, `Is_Advance`, `Payment_Date`) VALUES
(1, 5, 5, 1, 'OR-00005', 2584.00, 2584.00, 0.00, 1, 'Initial Settlement Payment', 0, '2026-09-26 18:54:33'),
(2, 6, 6, 1, 'OR-00006', 3101.00, 5951.00, 2850.00, 1, 'Initial Settlement Payment', 0, '2026-09-28 00:40:53'),
(3, 6, 6, 1, 'OR-00003', 1000.00, 2850.00, 1850.00, 4, 'Installment payment via GCash', 0, '2026-09-28 01:04:36'),
(4, 6, 6, 1, 'OR-00004', 1850.00, 1850.00, 0.00, 1, 'Follow-up Installment Payment', 0, '2026-09-28 02:09:19'),
(5, 7, 7, 1, 'OR-00005', 1305.00, 1755.00, 450.00, 1, 'Initial Settlement Payment', 0, '2026-09-28 19:17:36'),
(6, 7, 7, 1, 'OR-00006', 200.00, 450.00, 250.00, 4, 'Follow-up Installment Payment', 0, '2026-09-30 17:17:03'),
(7, 7, 7, 1, 'OR-00007', 250.00, 250.00, 0.00, 4, 'Follow-up Installment Payment', 0, '2026-09-30 17:18:40'),
(8, 8, 8, 1, 'OR-00008', 1080.00, 2795.40, 1715.40, 1, 'Initial Settlement Payment', 0, '2026-09-30 17:46:43'),
(9, 8, 8, 1, 'OR-00009', 1000.00, 1715.40, 715.40, 1, 'Follow-up Installment Payment', 0, '2026-09-30 17:47:37'),
(10, 8, 8, 1, 'OR-00010', 715.40, 715.40, 0.00, 1, 'Follow-up Installment Payment', 0, '2026-09-30 17:47:54'),
(11, 9, 9, 1, 'OR-00011', 500.00, 5950.00, 5450.00, 1, 'Test Initial Deposit', 1, '2026-10-02 17:05:20'),
(12, 9, 9, 1, 'OR-00012', 2060.00, 3060.00, 1000.00, 1, 'Final Discharge Settlement Payment', 0, '2026-10-02 17:24:49'),
(13, 9, 9, 1, 'OR-00013', 1000.00, 1000.00, 0.00, 1, 'Follow-up Installment Payment', 0, '2026-10-03 20:45:41'),
(14, 10, 10, 1, 'OR-00014', 1702.50, 10215.00, 8512.50, 1, 'Follow-up Installment Payment', 0, '2026-10-03 21:06:18'),
(16, 12, 12, 1, 'OR-00015', 5000.00, 5000.00, 0.00, 1, 'Follow-up Installment Payment', 0, '2026-10-04 18:55:46'),
(17, 13, 10, 1, 'OR-00016', 12015.00, 12015.00, 0.00, 1, 'Final Discharge Settlement Payment', 0, '2026-10-05 23:01:38'),
(18, 10, 10, 1, 'OR-00017', 8512.50, 8512.50, 0.00, 1, 'Follow-up Installment Payment', 0, '2026-10-05 23:02:33'),
(19, 14, 15, 1, 'OR-00018', 525.00, 1550.00, 1025.00, 2, 'Advance Patient Deposit', 1, '2026-10-05 23:48:02'),
(20, 14, 15, 1, 'OR-00019', 525.00, 1025.00, 500.00, 1, 'Advance Patient Deposit', 1, '2026-10-05 23:49:07'),
(21, 14, 15, 1, 'OR-00020', 500.00, 500.00, 0.00, 1, 'Final Discharge Settlement Payment', 0, '2026-10-05 23:52:21'),
(22, NULL, 14, 1, 'OR-00021', 1500.00, 1525.00, 25.00, 1, 'Advance Patient Deposit', 1, '2026-10-05 23:54:42'),
(23, 15, 16, 1, 'OR-00022', 1000.00, 6555.00, 5555.00, 1, 'Advance Patient Deposit', 1, '2026-10-06 00:32:04'),
(24, 15, 16, 1, 'OR-00023', 4224.50, 4224.50, 0.00, 1, 'Final Discharge Settlement Payment', 0, '2026-10-06 00:37:14');

-- --------------------------------------------------------

--
-- Table structure for table `patient`
--

CREATE TABLE `patient` (
  `Patient_ID` int(11) NOT NULL,
  `First_Name` varchar(50) NOT NULL,
  `Last_Name` varchar(50) NOT NULL,
  `Date_Of_Birth` date NOT NULL,
  `Gender_ID` int(11) NOT NULL,
  `Gender_Specification` varchar(50) DEFAULT NULL,
  `Blood_Type_ID` int(11) NOT NULL,
  `Contact_Number` varchar(20) DEFAULT NULL,
  `Address` varchar(255) DEFAULT NULL,
  `Emergency_Contact_Name` varchar(100) DEFAULT NULL,
  `Emergency_Contact_Number` varchar(20) DEFAULT NULL,
  `Is_Active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `patient`
--

INSERT INTO `patient` (`Patient_ID`, `First_Name`, `Last_Name`, `Date_Of_Birth`, `Gender_ID`, `Gender_Specification`, `Blood_Type_ID`, `Contact_Number`, `Address`, `Emergency_Contact_Name`, `Emergency_Contact_Number`, `Is_Active`) VALUES
(1, 'Juan', 'Dela Cruz', '1985-04-12', 1, NULL, 1, '09171234567', '123 Rizal St, Manila', 'Maria Dela Cruz', '09179991111', 1),
(2, 'Maria', 'Santos', '1992-08-25', 2, NULL, 7, '09182345678', '45 Mabini Ave, Quezon City', 'Pedro Santos', '09188882222', 1),
(3, 'Antonio', 'Luna', '1970-11-03', 1, NULL, 3, '09193456789', '78 Bonifacio Rd, Makati', 'Clara Luna', '09197773333', 1),
(4, 'Teresa', 'Magbanua', '1998-02-14', 2, NULL, 5, '09204567890', '12 Luna St, Pasig', 'Elias Magbanua', '09206664444', 1),
(5, 'Emilio', 'Aguinaldo', '1955-03-22', 1, NULL, 7, '09215678901', '89 Kawit Blvd, Cavite', 'Hilaria Del Rosario', '09215555555', 1),
(7, 'Elijah', 'Villaluna', '2026-09-25', 1, NULL, 3, '0912345678', 'Tablon', 'Lelian', '0912345678', 0),
(8, 'Elijah Paul', 'Villaluna', '2006-09-06', 1, NULL, 3, '09517443454', '123 Tablon, CDO City', 'Lelian Lanzaderas', '09517443454', 1),
(9, 'Juan Dela', 'Cruz', '1998-02-20', 1, NULL, 4, '09123456789', '123 Tablon, CDO City', 'Elijah Vill', '09111111111', 1);

-- --------------------------------------------------------

--
-- Table structure for table `promissory_note`
--

CREATE TABLE `promissory_note` (
  `Note_ID` int(11) NOT NULL,
  `Invoice_ID` int(11) NOT NULL,
  `Admission_ID` int(11) NOT NULL,
  `Total_Balance_Owed` decimal(12,2) NOT NULL,
  `Plan_Type_ID` int(11) NOT NULL,
  `Installment_Months` int(11) DEFAULT 1,
  `Monthly_Amount` decimal(12,2) NOT NULL,
  `Next_Due_Date` date NOT NULL,
  `Guarantor_Name` varchar(150) DEFAULT NULL,
  `Guarantor_Contact` varchar(50) DEFAULT NULL,
  `Notes` varchar(255) DEFAULT NULL,
  `Status` enum('Active','Settled','Overdue') NOT NULL DEFAULT 'Active',
  `Created_At` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `promissory_note`
--

INSERT INTO `promissory_note` (`Note_ID`, `Invoice_ID`, `Admission_ID`, `Total_Balance_Owed`, `Plan_Type_ID`, `Installment_Months`, `Monthly_Amount`, `Next_Due_Date`, `Guarantor_Name`, `Guarantor_Contact`, `Notes`, `Status`, `Created_At`) VALUES
(1, 9, 9, 0.00, 2, 2, 500.00, '2026-11-02', 'Pedro Luna', '0920-111-2222', 'Agreed to pay in 2 monthly installments of 500.00', 'Settled', '2026-10-03 19:08:33'),
(2, 10, 10, 0.00, 2, 6, 1702.50, '2026-11-02', 'Elias Magbanua', '0920-666-4444', 'Promissory Note agreement executed at discharge', 'Settled', '2026-10-03 21:04:31'),
(3, 12, 12, 0.00, 2, 3, 1666.67, '2026-11-02', 'Clara Luna', '0919-777-3333', 'Promissory Note agreement executed at discharge', 'Settled', '2026-10-03 22:53:29');

-- --------------------------------------------------------

--
-- Table structure for table `room`
--

CREATE TABLE `room` (
  `Room_ID` int(11) NOT NULL,
  `Room_Name` varchar(50) NOT NULL,
  `Room_Type_ID` int(11) NOT NULL,
  `Capacity` int(11) NOT NULL,
  `Custom_Daily_Rate` decimal(10,2) DEFAULT NULL,
  `Is_Active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `room`
--

INSERT INTO `room` (`Room_ID`, `Room_Name`, `Room_Type_ID`, `Capacity`, `Custom_Daily_Rate`, `Is_Active`) VALUES
(1, 'Ward A', 1, 4, NULL, 1),
(2, 'Ward B', 1, 4, 500.00, 1),
(3, 'Semi-Private', 2, 2, NULL, 1),
(4, 'Private 301', 3, 1, NULL, 1),
(5, 'Private 302', 3, 1, NULL, 1),
(6, 'ICU Unit', 4, 2, NULL, 1),
(7, 'Ward C', 1, 4, 500.00, 1),
(8, 'Emergency Room', 5, 10, 100.00, 1);

-- --------------------------------------------------------

--
-- Table structure for table `room_bed`
--

CREATE TABLE `room_bed` (
  `Bed_ID` int(11) NOT NULL,
  `Room_ID` int(11) NOT NULL,
  `Bed_Code` varchar(20) NOT NULL,
  `Is_Available` tinyint(1) DEFAULT 1,
  `Is_Active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `room_bed`
--

INSERT INTO `room_bed` (`Bed_ID`, `Room_ID`, `Bed_Code`, `Is_Available`, `Is_Active`) VALUES
(1, 1, 'WRD-A-001', 1, 1),
(2, 1, 'WRD-A-002', 1, 1),
(3, 1, 'WRD-A-003', 1, 1),
(4, 1, 'WRD-A-004', 1, 1),
(5, 2, 'WRD-B-001', 1, 1),
(6, 2, 'WRD-B-002', 1, 1),
(7, 2, 'WRD-B-003', 1, 1),
(8, 2, 'WRD-B-004', 1, 1),
(9, 3, 'SPVT-001', 1, 1),
(10, 3, 'SPVT-002', 1, 1),
(11, 4, 'PVT-301', 1, 1),
(12, 5, 'PVT-302', 1, 1),
(13, 6, 'ICU-001', 1, 1),
(14, 6, 'ICU-002', 1, 1),
(15, 7, 'WRD-C-001', 0, 1),
(16, 7, 'WRD-C-002', 1, 1),
(17, 7, 'WRD-C-003', 1, 1),
(18, 7, 'WRD-C-004', 1, 1),
(19, 8, 'EMERG-001', 1, 1),
(20, 8, 'EMERG-002', 1, 1),
(21, 8, 'EMERG-003', 1, 1),
(22, 8, 'EMERG-004', 1, 1),
(23, 8, 'EMERG-005', 1, 1),
(24, 8, 'EMERG-006', 1, 1),
(25, 8, 'EMERG-007', 1, 1),
(26, 8, 'EMERG-008', 1, 1),
(27, 8, 'EMERG-009', 1, 1),
(28, 8, 'EMERG-010', 1, 1);

-- --------------------------------------------------------

--
-- Table structure for table `room_transfer_log`
--

CREATE TABLE `room_transfer_log` (
  `Transfer_ID` int(11) NOT NULL,
  `Admission_ID` int(11) NOT NULL,
  `Bed_ID` int(11) NOT NULL,
  `Date_In` datetime NOT NULL DEFAULT current_timestamp(),
  `Date_Out` datetime DEFAULT NULL,
  `Total_Days` int(11) DEFAULT NULL,
  `Total_Room_Fee` decimal(12,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `room_transfer_log`
--

INSERT INTO `room_transfer_log` (`Transfer_ID`, `Admission_ID`, `Bed_ID`, `Date_In`, `Date_Out`, `Total_Days`, `Total_Room_Fee`) VALUES
(6, 5, 15, '2026-09-26 18:51:23', '2026-09-26 18:53:48', 1, 500.00),
(7, 5, 16, '2026-09-26 18:53:48', '2026-09-26 18:54:33', 1, 500.00),
(8, 6, 1, '2026-09-28 00:05:45', '2026-09-28 00:08:37', 1, 500.00),
(9, 6, 11, '2026-09-28 00:08:37', '2026-09-28 00:40:53', 1, 2000.00),
(10, 7, 1, '2026-09-28 19:06:54', '2026-09-28 19:17:36', 1, 500.00),
(12, 8, 1, '2026-09-28 19:36:27', '2026-09-30 17:40:14', 1, 500.00),
(13, 8, 9, '2026-09-30 17:40:14', '2026-09-30 17:43:13', 1, 1200.00),
(14, 9, 12, '2026-10-02 03:06:03', '2026-10-02 15:24:52', 1, 2000.00),
(15, 9, 10, '2026-10-02 15:24:52', '2026-10-02 17:09:51', 1, 1200.00),
(16, 10, 13, '2026-10-03 20:51:20', '2026-10-03 20:54:54', 1, 5000.00),
(17, 10, 11, '2026-10-03 20:54:54', '2026-10-03 21:01:36', 1, 2000.00),
(19, 12, 13, '2026-10-03 21:43:07', '2026-10-03 21:43:15', 1, 5000.00),
(20, 13, 19, '2026-10-05 02:34:32', '2026-10-05 02:42:48', 1, 100.00),
(21, 13, 15, '2026-10-05 02:42:48', NULL, NULL, NULL),
(22, 14, 19, '2026-10-05 23:11:54', '2026-10-05 23:14:05', 1, 100.00),
(23, 14, 1, '2026-10-05 23:14:05', '2026-10-06 00:40:06', 1, 500.00),
(24, 15, 19, '2026-10-05 23:43:08', '2026-10-05 23:44:52', 1, 100.00),
(25, 15, 3, '2026-10-05 23:44:52', '2026-10-05 23:51:07', 1, 500.00),
(26, 16, 19, '2026-10-06 00:27:16', '2026-10-06 00:29:13', 1, 100.00),
(27, 16, 18, '2026-10-06 00:29:13', '2026-10-06 00:34:07', 1, 500.00);

-- --------------------------------------------------------

--
-- Table structure for table `system_user`
--

CREATE TABLE `system_user` (
  `User_ID` int(11) NOT NULL,
  `First_Name` varchar(50) NOT NULL,
  `Last_Name` varchar(50) NOT NULL,
  `Username` varchar(50) NOT NULL,
  `Password_Hash` varchar(255) NOT NULL,
  `Role_ID` int(11) NOT NULL,
  `Is_Active` tinyint(1) DEFAULT 1,
  `Station_ID` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `system_user`
--

INSERT INTO `system_user` (`User_ID`, `First_Name`, `Last_Name`, `Username`, `Password_Hash`, `Role_ID`, `Is_Active`, `Station_ID`) VALUES
(1, 'System', 'Admin', 'admin', '$2y$10$biTrtQIEZqTDccD1oXZ0i.MWSd8dkL5mZ56w1Vur12r/8Vn5sHAJC', 1, 1, NULL),
(2, 'Finance', 'Staff', 'finance', '$2y$10$1aXJba0q5YraQCoGuC/xVe0OP4WOQ2uyhA7PnNld/.a.6oRPF/VH6', 2, 1, 7),
(3, 'Jane', 'Nurse', 'nurse', '$2y$10$3slZCfvtR3YzAMvrDNJI8eiMkf4ZL9R9z6Gpr4pNwNNz4gVDlM21.', 3, 1, 5);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admission`
--
ALTER TABLE `admission`
  ADD PRIMARY KEY (`Admission_ID`),
  ADD KEY `Patient_ID` (`Patient_ID`);

--
-- Indexes for table `admission_doctor`
--
ALTER TABLE `admission_doctor`
  ADD PRIMARY KEY (`Admission_Doctor_ID`),
  ADD KEY `Admission_ID` (`Admission_ID`),
  ADD KEY `Doctor_ID` (`Doctor_ID`);

--
-- Indexes for table `audit_log`
--
ALTER TABLE `audit_log`
  ADD PRIMARY KEY (`Audit_ID`),
  ADD KEY `User_ID` (`User_ID`),
  ADD KEY `Admission_ID` (`Admission_ID`),
  ADD KEY `fk_audit_log_module` (`Module_ID`),
  ADD KEY `fk_audit_log_action` (`Action_ID`);

--
-- Indexes for table `billing_ledger`
--
ALTER TABLE `billing_ledger`
  ADD PRIMARY KEY (`Ledger_ID`),
  ADD KEY `Admission_ID` (`Admission_ID`),
  ADD KEY `Station_ID` (`Station_ID`),
  ADD KEY `Catalog_ID` (`Catalog_ID`),
  ADD KEY `Request_ID` (`Request_ID`),
  ADD KEY `Round_ID` (`Round_ID`),
  ADD KEY `Transfer_ID` (`Transfer_ID`);

--
-- Indexes for table `charge_catalogs`
--
ALTER TABLE `charge_catalogs`
  ADD PRIMARY KEY (`Catalog_ID`);

--
-- Indexes for table `doctor`
--
ALTER TABLE `doctor`
  ADD PRIMARY KEY (`Doctor_ID`),
  ADD KEY `Doctor_Type_ID` (`Doctor_Type_ID`),
  ADD KEY `Station_ID` (`Station_ID`);

--
-- Indexes for table `doctor_order_request`
--
ALTER TABLE `doctor_order_request`
  ADD PRIMARY KEY (`Request_ID`),
  ADD KEY `Admission_Doctor_ID` (`Admission_Doctor_ID`),
  ADD KEY `Catalog_ID` (`Catalog_ID`);

--
-- Indexes for table `doctor_round_log`
--
ALTER TABLE `doctor_round_log`
  ADD PRIMARY KEY (`Round_ID`),
  ADD KEY `Admission_Doctor_ID` (`Admission_Doctor_ID`);

--
-- Indexes for table `doctor_specialty`
--
ALTER TABLE `doctor_specialty`
  ADD PRIMARY KEY (`Doctor_Specialty_ID`),
  ADD KEY `Doctor_ID` (`Doctor_ID`),
  ADD KEY `Specialty_ID` (`Specialty_ID`);

--
-- Indexes for table `enum_audit_action`
--
ALTER TABLE `enum_audit_action`
  ADD PRIMARY KEY (`Action_ID`),
  ADD UNIQUE KEY `Action_Type` (`Action_Type`);

--
-- Indexes for table `enum_audit_module`
--
ALTER TABLE `enum_audit_module`
  ADD PRIMARY KEY (`Module_ID`),
  ADD UNIQUE KEY `Module_Name` (`Module_Name`);

--
-- Indexes for table `enum_blood_type`
--
ALTER TABLE `enum_blood_type`
  ADD PRIMARY KEY (`Blood_Type_ID`);

--
-- Indexes for table `enum_department_station`
--
ALTER TABLE `enum_department_station`
  ADD PRIMARY KEY (`Station_ID`);

--
-- Indexes for table `enum_discount`
--
ALTER TABLE `enum_discount`
  ADD PRIMARY KEY (`Discount_ID`),
  ADD KEY `fk_enum_discount_type` (`Discount_Type_ID`);

--
-- Indexes for table `enum_discount_type`
--
ALTER TABLE `enum_discount_type`
  ADD PRIMARY KEY (`Discount_Type_ID`);

--
-- Indexes for table `enum_doctor_type`
--
ALTER TABLE `enum_doctor_type`
  ADD PRIMARY KEY (`Doctor_Type_ID`);

--
-- Indexes for table `enum_gender`
--
ALTER TABLE `enum_gender`
  ADD PRIMARY KEY (`Gender_ID`);

--
-- Indexes for table `enum_payment_method`
--
ALTER TABLE `enum_payment_method`
  ADD PRIMARY KEY (`Payment_Method_ID`);

--
-- Indexes for table `enum_promissory_plan_type`
--
ALTER TABLE `enum_promissory_plan_type`
  ADD PRIMARY KEY (`Plan_Type_ID`),
  ADD UNIQUE KEY `Plan_Type_Code` (`Plan_Type_Code`);

--
-- Indexes for table `enum_room_type`
--
ALTER TABLE `enum_room_type`
  ADD PRIMARY KEY (`Room_Type_ID`);

--
-- Indexes for table `enum_specialty`
--
ALTER TABLE `enum_specialty`
  ADD PRIMARY KEY (`Specialty_ID`);

--
-- Indexes for table `enum_user_role`
--
ALTER TABLE `enum_user_role`
  ADD PRIMARY KEY (`Role_ID`);

--
-- Indexes for table `final_invoice`
--
ALTER TABLE `final_invoice`
  ADD PRIMARY KEY (`Invoice_ID`),
  ADD KEY `Admission_ID` (`Admission_ID`),
  ADD KEY `Processed_By_User_ID` (`Processed_By_User_ID`),
  ADD KEY `Discount_ID` (`Discount_ID`);

--
-- Indexes for table `invoice_applied_discount`
--
ALTER TABLE `invoice_applied_discount`
  ADD PRIMARY KEY (`Applied_Discount_ID`),
  ADD KEY `Invoice_ID` (`Invoice_ID`),
  ADD KEY `fk_applied_discount_enum` (`Discount_ID`);

--
-- Indexes for table `invoice_payment`
--
ALTER TABLE `invoice_payment`
  ADD PRIMARY KEY (`Payment_ID`),
  ADD KEY `Admission_ID` (`Admission_ID`),
  ADD KEY `Cashier_User_ID` (`Cashier_User_ID`),
  ADD KEY `fk_payment_method` (`Payment_Method_ID`),
  ADD KEY `fk_invoice_payment_invoice` (`Invoice_ID`);

--
-- Indexes for table `patient`
--
ALTER TABLE `patient`
  ADD PRIMARY KEY (`Patient_ID`),
  ADD KEY `Gender_ID` (`Gender_ID`),
  ADD KEY `Blood_Type_ID` (`Blood_Type_ID`);

--
-- Indexes for table `promissory_note`
--
ALTER TABLE `promissory_note`
  ADD PRIMARY KEY (`Note_ID`),
  ADD KEY `Invoice_ID` (`Invoice_ID`),
  ADD KEY `Admission_ID` (`Admission_ID`),
  ADD KEY `Plan_Type_ID` (`Plan_Type_ID`);

--
-- Indexes for table `room`
--
ALTER TABLE `room`
  ADD PRIMARY KEY (`Room_ID`),
  ADD KEY `Room_Type_ID` (`Room_Type_ID`);

--
-- Indexes for table `room_bed`
--
ALTER TABLE `room_bed`
  ADD PRIMARY KEY (`Bed_ID`),
  ADD KEY `Room_ID` (`Room_ID`);

--
-- Indexes for table `room_transfer_log`
--
ALTER TABLE `room_transfer_log`
  ADD PRIMARY KEY (`Transfer_ID`),
  ADD KEY `Admission_ID` (`Admission_ID`),
  ADD KEY `Bed_ID` (`Bed_ID`);

--
-- Indexes for table `system_user`
--
ALTER TABLE `system_user`
  ADD PRIMARY KEY (`User_ID`),
  ADD UNIQUE KEY `Username` (`Username`),
  ADD KEY `Role_ID` (`Role_ID`),
  ADD KEY `Station_ID` (`Station_ID`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admission`
--
ALTER TABLE `admission`
  MODIFY `Admission_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `admission_doctor`
--
ALTER TABLE `admission_doctor`
  MODIFY `Admission_Doctor_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;

--
-- AUTO_INCREMENT for table `audit_log`
--
ALTER TABLE `audit_log`
  MODIFY `Audit_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=153;

--
-- AUTO_INCREMENT for table `billing_ledger`
--
ALTER TABLE `billing_ledger`
  MODIFY `Ledger_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=81;

--
-- AUTO_INCREMENT for table `charge_catalogs`
--
ALTER TABLE `charge_catalogs`
  MODIFY `Catalog_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `doctor`
--
ALTER TABLE `doctor`
  MODIFY `Doctor_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `doctor_order_request`
--
ALTER TABLE `doctor_order_request`
  MODIFY `Request_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;

--
-- AUTO_INCREMENT for table `doctor_round_log`
--
ALTER TABLE `doctor_round_log`
  MODIFY `Round_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `doctor_specialty`
--
ALTER TABLE `doctor_specialty`
  MODIFY `Doctor_Specialty_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `enum_audit_action`
--
ALTER TABLE `enum_audit_action`
  MODIFY `Action_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `enum_audit_module`
--
ALTER TABLE `enum_audit_module`
  MODIFY `Module_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `enum_blood_type`
--
ALTER TABLE `enum_blood_type`
  MODIFY `Blood_Type_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `enum_department_station`
--
ALTER TABLE `enum_department_station`
  MODIFY `Station_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `enum_discount`
--
ALTER TABLE `enum_discount`
  MODIFY `Discount_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `enum_discount_type`
--
ALTER TABLE `enum_discount_type`
  MODIFY `Discount_Type_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `enum_doctor_type`
--
ALTER TABLE `enum_doctor_type`
  MODIFY `Doctor_Type_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `enum_gender`
--
ALTER TABLE `enum_gender`
  MODIFY `Gender_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `enum_payment_method`
--
ALTER TABLE `enum_payment_method`
  MODIFY `Payment_Method_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `enum_promissory_plan_type`
--
ALTER TABLE `enum_promissory_plan_type`
  MODIFY `Plan_Type_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `enum_room_type`
--
ALTER TABLE `enum_room_type`
  MODIFY `Room_Type_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `enum_specialty`
--
ALTER TABLE `enum_specialty`
  MODIFY `Specialty_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `enum_user_role`
--
ALTER TABLE `enum_user_role`
  MODIFY `Role_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `final_invoice`
--
ALTER TABLE `final_invoice`
  MODIFY `Invoice_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `invoice_applied_discount`
--
ALTER TABLE `invoice_applied_discount`
  MODIFY `Applied_Discount_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `invoice_payment`
--
ALTER TABLE `invoice_payment`
  MODIFY `Payment_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `patient`
--
ALTER TABLE `patient`
  MODIFY `Patient_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `promissory_note`
--
ALTER TABLE `promissory_note`
  MODIFY `Note_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `room`
--
ALTER TABLE `room`
  MODIFY `Room_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `room_bed`
--
ALTER TABLE `room_bed`
  MODIFY `Bed_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;

--
-- AUTO_INCREMENT for table `room_transfer_log`
--
ALTER TABLE `room_transfer_log`
  MODIFY `Transfer_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `system_user`
--
ALTER TABLE `system_user`
  MODIFY `User_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `admission`
--
ALTER TABLE `admission`
  ADD CONSTRAINT `admission_ibfk_1` FOREIGN KEY (`Patient_ID`) REFERENCES `patient` (`Patient_ID`);

--
-- Constraints for table `admission_doctor`
--
ALTER TABLE `admission_doctor`
  ADD CONSTRAINT `admission_doctor_ibfk_1` FOREIGN KEY (`Admission_ID`) REFERENCES `admission` (`Admission_ID`),
  ADD CONSTRAINT `admission_doctor_ibfk_2` FOREIGN KEY (`Doctor_ID`) REFERENCES `doctor` (`Doctor_ID`);

--
-- Constraints for table `audit_log`
--
ALTER TABLE `audit_log`
  ADD CONSTRAINT `audit_log_ibfk_1` FOREIGN KEY (`User_ID`) REFERENCES `system_user` (`User_ID`) ON DELETE SET NULL,
  ADD CONSTRAINT `audit_log_ibfk_2` FOREIGN KEY (`Admission_ID`) REFERENCES `admission` (`Admission_ID`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_audit_log_action` FOREIGN KEY (`Action_ID`) REFERENCES `enum_audit_action` (`Action_ID`),
  ADD CONSTRAINT `fk_audit_log_module` FOREIGN KEY (`Module_ID`) REFERENCES `enum_audit_module` (`Module_ID`);

--
-- Constraints for table `billing_ledger`
--
ALTER TABLE `billing_ledger`
  ADD CONSTRAINT `billing_ledger_ibfk_1` FOREIGN KEY (`Admission_ID`) REFERENCES `admission` (`Admission_ID`),
  ADD CONSTRAINT `billing_ledger_ibfk_2` FOREIGN KEY (`Station_ID`) REFERENCES `enum_department_station` (`Station_ID`),
  ADD CONSTRAINT `billing_ledger_ibfk_3` FOREIGN KEY (`Catalog_ID`) REFERENCES `charge_catalogs` (`Catalog_ID`),
  ADD CONSTRAINT `billing_ledger_ibfk_4` FOREIGN KEY (`Request_ID`) REFERENCES `doctor_order_request` (`Request_ID`),
  ADD CONSTRAINT `billing_ledger_ibfk_5` FOREIGN KEY (`Round_ID`) REFERENCES `doctor_round_log` (`Round_ID`),
  ADD CONSTRAINT `billing_ledger_ibfk_6` FOREIGN KEY (`Transfer_ID`) REFERENCES `room_transfer_log` (`Transfer_ID`);

--
-- Constraints for table `doctor`
--
ALTER TABLE `doctor`
  ADD CONSTRAINT `doctor_ibfk_1` FOREIGN KEY (`Doctor_Type_ID`) REFERENCES `enum_doctor_type` (`Doctor_Type_ID`),
  ADD CONSTRAINT `doctor_ibfk_2` FOREIGN KEY (`Station_ID`) REFERENCES `enum_department_station` (`Station_ID`);

--
-- Constraints for table `doctor_order_request`
--
ALTER TABLE `doctor_order_request`
  ADD CONSTRAINT `doctor_order_request_ibfk_1` FOREIGN KEY (`Admission_Doctor_ID`) REFERENCES `admission_doctor` (`Admission_Doctor_ID`),
  ADD CONSTRAINT `doctor_order_request_ibfk_2` FOREIGN KEY (`Catalog_ID`) REFERENCES `charge_catalogs` (`Catalog_ID`);

--
-- Constraints for table `doctor_round_log`
--
ALTER TABLE `doctor_round_log`
  ADD CONSTRAINT `doctor_round_log_ibfk_1` FOREIGN KEY (`Admission_Doctor_ID`) REFERENCES `admission_doctor` (`Admission_Doctor_ID`);

--
-- Constraints for table `doctor_specialty`
--
ALTER TABLE `doctor_specialty`
  ADD CONSTRAINT `doctor_specialty_ibfk_1` FOREIGN KEY (`Doctor_ID`) REFERENCES `doctor` (`Doctor_ID`) ON DELETE CASCADE,
  ADD CONSTRAINT `doctor_specialty_ibfk_2` FOREIGN KEY (`Specialty_ID`) REFERENCES `enum_specialty` (`Specialty_ID`);

--
-- Constraints for table `enum_discount`
--
ALTER TABLE `enum_discount`
  ADD CONSTRAINT `fk_enum_discount_type` FOREIGN KEY (`Discount_Type_ID`) REFERENCES `enum_discount_type` (`Discount_Type_ID`);

--
-- Constraints for table `final_invoice`
--
ALTER TABLE `final_invoice`
  ADD CONSTRAINT `final_invoice_ibfk_1` FOREIGN KEY (`Admission_ID`) REFERENCES `admission` (`Admission_ID`),
  ADD CONSTRAINT `final_invoice_ibfk_2` FOREIGN KEY (`Processed_By_User_ID`) REFERENCES `system_user` (`User_ID`),
  ADD CONSTRAINT `final_invoice_ibfk_3` FOREIGN KEY (`Discount_ID`) REFERENCES `enum_discount` (`Discount_ID`);

--
-- Constraints for table `invoice_applied_discount`
--
ALTER TABLE `invoice_applied_discount`
  ADD CONSTRAINT `fk_applied_discount_enum` FOREIGN KEY (`Discount_ID`) REFERENCES `enum_discount` (`Discount_ID`),
  ADD CONSTRAINT `invoice_applied_discount_ibfk_1` FOREIGN KEY (`Invoice_ID`) REFERENCES `final_invoice` (`Invoice_ID`) ON DELETE CASCADE;

--
-- Constraints for table `invoice_payment`
--
ALTER TABLE `invoice_payment`
  ADD CONSTRAINT `fk_invoice_payment_invoice` FOREIGN KEY (`Invoice_ID`) REFERENCES `final_invoice` (`Invoice_ID`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_payment_method` FOREIGN KEY (`Payment_Method_ID`) REFERENCES `enum_payment_method` (`Payment_Method_ID`),
  ADD CONSTRAINT `invoice_payment_ibfk_2` FOREIGN KEY (`Admission_ID`) REFERENCES `admission` (`Admission_ID`),
  ADD CONSTRAINT `invoice_payment_ibfk_3` FOREIGN KEY (`Cashier_User_ID`) REFERENCES `system_user` (`User_ID`);

--
-- Constraints for table `patient`
--
ALTER TABLE `patient`
  ADD CONSTRAINT `patient_ibfk_1` FOREIGN KEY (`Gender_ID`) REFERENCES `enum_gender` (`Gender_ID`),
  ADD CONSTRAINT `patient_ibfk_2` FOREIGN KEY (`Blood_Type_ID`) REFERENCES `enum_blood_type` (`Blood_Type_ID`);

--
-- Constraints for table `promissory_note`
--
ALTER TABLE `promissory_note`
  ADD CONSTRAINT `promissory_note_ibfk_1` FOREIGN KEY (`Invoice_ID`) REFERENCES `final_invoice` (`Invoice_ID`) ON DELETE CASCADE,
  ADD CONSTRAINT `promissory_note_ibfk_2` FOREIGN KEY (`Admission_ID`) REFERENCES `admission` (`Admission_ID`),
  ADD CONSTRAINT `promissory_note_ibfk_3` FOREIGN KEY (`Plan_Type_ID`) REFERENCES `enum_promissory_plan_type` (`Plan_Type_ID`);

--
-- Constraints for table `room`
--
ALTER TABLE `room`
  ADD CONSTRAINT `room_ibfk_1` FOREIGN KEY (`Room_Type_ID`) REFERENCES `enum_room_type` (`Room_Type_ID`);

--
-- Constraints for table `room_bed`
--
ALTER TABLE `room_bed`
  ADD CONSTRAINT `room_bed_ibfk_1` FOREIGN KEY (`Room_ID`) REFERENCES `room` (`Room_ID`) ON DELETE CASCADE;

--
-- Constraints for table `room_transfer_log`
--
ALTER TABLE `room_transfer_log`
  ADD CONSTRAINT `room_transfer_log_ibfk_1` FOREIGN KEY (`Admission_ID`) REFERENCES `admission` (`Admission_ID`),
  ADD CONSTRAINT `room_transfer_log_ibfk_2` FOREIGN KEY (`Bed_ID`) REFERENCES `room_bed` (`Bed_ID`);

--
-- Constraints for table `system_user`
--
ALTER TABLE `system_user`
  ADD CONSTRAINT `system_user_ibfk_1` FOREIGN KEY (`Role_ID`) REFERENCES `enum_user_role` (`Role_ID`),
  ADD CONSTRAINT `system_user_ibfk_2` FOREIGN KEY (`Station_ID`) REFERENCES `enum_department_station` (`Station_ID`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
