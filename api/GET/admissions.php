<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class AdmissionManager
{
    function getAllAdmissions($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $statusFilter = $json['status'] ?? 'all';
        $search = trim($json['search'] ?? '');

        $sql = "SELECT 
                    a.Admission_ID,
                    a.Patient_ID,
                    CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                    CONCAT(p.Last_Name, ', ', p.First_Name) AS Patient_Name,
                    p.Contact_Number,
                    a.Chief_Complaint,
                    a.Diagnosis,
                    DATE_FORMAT(a.Admission_Date, '%Y-%m-%d %h:%i %p') AS Admission_Date,
                    a.Status,
                    rb.Bed_Code,
                    r.Room_Name,
                    rt.Type_Name AS Room_Type,
                    COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate,
                    (
                        SELECT GROUP_CONCAT(CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) SEPARATOR '; ')
                        FROM Admission_Doctor ad
                        INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                        WHERE ad.Admission_ID = a.Admission_ID
                    ) AS Assigned_Doctors
                FROM Admission a
                INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                LEFT JOIN Room_Transfer_Log rtl ON rtl.Admission_ID = a.Admission_ID AND rtl.Date_Out IS NULL
                LEFT JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                LEFT JOIN Room r ON rb.Room_ID = r.Room_ID
                LEFT JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                WHERE 1=1";

        $params = [];

        if ($statusFilter !== 'all' && !empty($statusFilter)) {
            $sql .= " AND a.Status = :status";
            $params[':status'] = $statusFilter;
        }

        if (!empty($search)) {
            $sql .= " AND (p.First_Name LIKE :search 
                           OR p.Last_Name LIKE :search 
                           OR rb.Bed_Code LIKE :search 
                           OR a.Chief_Complaint LIKE :search 
                           OR a.Diagnosis LIKE :search 
                           OR a.Admission_ID = :search_id)";
            $params[':search'] = "%{$search}%";
            $params[':search_id'] = is_numeric($search) ? intval($search) : 0;
        }

        $sql .= " ORDER BY a.Admission_ID DESC";

        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        $admissions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($admissions);
    }

    function getAdmissionById($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $id = intval($json['id'] ?? $json['admission_id'] ?? 0);

        if (empty($id)) {
            return json_encode(['error' => 'Admission ID is required.']);
        }

        $sql = "SELECT 
                    a.Admission_ID,
                    a.Chief_Complaint,
                    a.Diagnosis,
                    DATE_FORMAT(a.Admission_Date, '%Y-%m-%d %h:%i %p') AS Admission_Date,
                    a.Status,
                    p.Patient_ID,
                    CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                    p.First_Name,
                    p.Last_Name,
                    CONCAT(p.Last_Name, ', ', p.First_Name) AS Full_Name,
                    CONCAT(p.Last_Name, ', ', p.First_Name) AS Patient_Name,
                    p.Date_Of_Birth,
                    TIMESTAMPDIFF(YEAR, p.Date_Of_Birth, CURDATE()) AS Age,
                    g.Gender_Name,
                    bt.Blood_Type_Name,
                    p.Contact_Number,
                    p.Address,
                    p.Emergency_Contact_Name,
                    p.Emergency_Contact_Number,
                    rtl.Transfer_ID,
                    rtl.Bed_ID,
                    rb.Bed_Code,
                    r.Room_Name,
                    rt.Type_Name AS Room_Type,
                    COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate,
                    DATE_FORMAT(rtl.Date_In, '%Y-%m-%d %h:%i %p') AS Bed_Date_In,
                    DATE_FORMAT(rtl.Date_In, '%Y-%m-%d %h:%i %p') AS Bed_Assigned_Since
                FROM Admission a
                INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                LEFT JOIN Enum_Gender g ON p.Gender_ID = g.Gender_ID
                LEFT JOIN Enum_Blood_Type bt ON p.Blood_Type_ID = bt.Blood_Type_ID
                LEFT JOIN Room_Transfer_Log rtl ON rtl.Admission_ID = a.Admission_ID AND rtl.Date_Out IS NULL
                LEFT JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                LEFT JOIN Room r ON rb.Room_ID = r.Room_ID
                LEFT JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                WHERE a.Admission_ID = :id";

        $stmt = $conn->prepare($sql);
        $stmt->execute([':id' => $id]);
        $admission = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$admission) {
            return json_encode(['error' => 'Admission record not found.']);
        }

        $docSql = "SELECT 
                    ad.Admission_Doctor_ID,
                    d.Doctor_ID,
                    CONCAT(d.Code_Prefix, '-', LPAD(d.Doctor_ID, 3, '0')) AS Doctor_Code,
                    CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                    dt.Type_Name AS Doctor_Type,
                    d.Base_Round_Fee,
                    d.Station_ID,
                    DATE_FORMAT(ad.Assigned_Date, '%Y-%m-%d %h:%i %p') AS Assigned_Date,
                    (
                        SELECT GROUP_CONCAT(s.Specialty_Name SEPARATOR ', ')
                        FROM Doctor_Specialty ds
                        INNER JOIN Enum_Specialty s ON ds.Specialty_ID = s.Specialty_ID
                        WHERE ds.Doctor_ID = d.Doctor_ID
                    ) AS Specialties
                FROM Admission_Doctor ad
                INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                INNER JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID
                INNER JOIN Enum_Department_Station st ON d.Station_ID = st.Station_ID
                WHERE ad.Admission_ID = :id";
        $docStmt = $conn->prepare($docSql);
        $docStmt->execute([':id' => $id]);
        $admission['Assigned_Doctors'] = $docStmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($admission);
    }

    function getAvailableBeds()
    {
        include "connection.php";

        $sql = "SELECT 
                    b.Bed_ID,
                    b.Bed_Code,
                    b.Room_ID,
                    r.Room_Name,
                    rt.Room_Type_ID,
                    rt.Type_Name AS Room_Type,
                    COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate
                FROM Room_Bed b
                INNER JOIN Room r ON b.Room_ID = r.Room_ID
                INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                WHERE b.Is_Available = 1 
                  AND b.Is_Active = 1 
                  AND r.Is_Active = 1
                ORDER BY r.Room_Name ASC, b.Bed_Code ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $beds = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($beds);
    }

    function getActivePatients()
    {
        include "connection.php";

        $sql = "SELECT 
                    p.Patient_ID,
                    CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                    CONCAT(p.Last_Name, ', ', p.First_Name) AS Full_Name,
                    p.Date_Of_Birth,
                    g.Gender_Name,
                    bt.Blood_Type_Name,
                    (
                        SELECT a.Admission_ID 
                        FROM Admission a 
                        WHERE a.Patient_ID = p.Patient_ID AND a.Status = 'Admitted'
                        LIMIT 1
                    ) AS Active_Admission_ID,
                    (
                        SELECT a.Status 
                        FROM Admission a 
                        WHERE a.Patient_ID = p.Patient_ID 
                        ORDER BY a.Admission_ID DESC 
                        LIMIT 1
                    ) AS Latest_Admission_Status
                FROM Patient p
                LEFT JOIN Enum_Gender g ON p.Gender_ID = g.Gender_ID
                LEFT JOIN Enum_Blood_Type bt ON p.Blood_Type_ID = bt.Blood_Type_ID
                WHERE p.Is_Active = 1
                ORDER BY p.Last_Name ASC, p.First_Name ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $patients = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($patients);
    }

    function getActiveDoctors()
    {
        include "connection.php";

        $sql = "SELECT 
                    d.Doctor_ID,
                    CONCAT(d.Code_Prefix, '-', LPAD(d.Doctor_ID, 3, '0')) AS Doctor_Code,
                    CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Full_Name,
                    dt.Type_Name AS Doctor_Type,
                    st.Station_Name,
                    d.Base_Round_Fee,
                    (
                        SELECT GROUP_CONCAT(s.Specialty_Name SEPARATOR ', ')
                        FROM Doctor_Specialty ds
                        INNER JOIN Enum_Specialty s ON ds.Specialty_ID = s.Specialty_ID
                        WHERE ds.Doctor_ID = d.Doctor_ID
                    ) AS Specialties
                FROM Doctor d
                INNER JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID
                INNER JOIN Enum_Department_Station st ON d.Station_ID = st.Station_ID
                WHERE d.Is_Active = 1
                ORDER BY d.Last_Name ASC, d.First_Name ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $doctors = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($doctors);
    }

    function getBedTransfers($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);

        if (empty($admissionId)) {
            return json_encode([]);
        }

        $sql = "SELECT 
                    rtl.Transfer_ID,
                    rtl.Admission_ID,
                    rtl.Bed_ID,
                    rb.Bed_Code,
                    r.Room_Name,
                    rt.Type_Name AS Room_Type,
                    DATE_FORMAT(rtl.Date_In, '%Y-%m-%d %h:%i %p') AS Date_In,
                    DATE_FORMAT(rtl.Date_Out, '%Y-%m-%d %h:%i %p') AS Date_Out,
                    rtl.Total_Days,
                    rtl.Total_Room_Fee,
                    (CASE WHEN rtl.Date_Out IS NULL THEN 1 ELSE 0 END) AS Is_Current
                FROM Room_Transfer_Log rtl
                INNER JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                INNER JOIN Room r ON rb.Room_ID = r.Room_ID
                INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                WHERE rtl.Admission_ID = :aid
                ORDER BY rtl.Transfer_ID ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute([':aid' => $admissionId]);
        $transfers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($transfers);
    }
}

if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'] ?? "";
    $json = $_GET['json'] ?? "{}";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $operation = $_POST['operation'] ?? "";
    $json = $_POST['json'] ?? "{}";
}

$admission = new AdmissionManager();
switch ($operation) {
    case 'getAllAdmissions':
        echo $admission->getAllAdmissions($json);
        break;
    case 'getAdmissionById':
        echo $admission->getAdmissionById($json);
        break;
    case 'getAvailableBeds':
        echo $admission->getAvailableBeds();
        break;
    case 'getActivePatients':
        echo $admission->getActivePatients();
        break;
    case 'getActiveDoctors':
        echo $admission->getActiveDoctors();
        break;
    case 'getBedTransfers':
        echo $admission->getBedTransfers($json);
        break;
}
?>
