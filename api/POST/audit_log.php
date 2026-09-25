<?php
if (!defined('AUDIT_HOOK_REGISTERED')) {
    define('AUDIT_HOOK_REGISTERED', true);
    ob_start();

    register_shutdown_function(function() use ($conn) {
        $output = trim(ob_get_contents());
        $op = $_POST['operation'] ?? $_GET['operation'] ?? '';
        $rawJson = $_POST['json'] ?? $_GET['json'] ?? '{}';
        $data = json_decode($rawJson, true) ?: [];

        if (empty($op)) return;

        $decodedOut = json_decode($output, true);
        $isSuccess = ($output === "1")
            || (is_array($decodedOut) && (($decodedOut['status'] ?? '') === 'success' || isset($decodedOut['user_id'])));

        if (!$isSuccess) return;

        $actionType = 'UPDATE';
        $module = 'System';
        $ref = '-';
        $desc = "Executed operation: $op";
        $by = $data['performed_by'] ?? 'System Admin';

        switch ($op) {
            case 'login':
                $actionType = 'AUTH';
                $module = 'Authentication';
                $ref = 'USR-' . str_pad($decodedOut['user_id'] ?? 1, 3, '0', STR_PAD_LEFT);
                $by = $decodedOut['full_name'] ?? ($data['username'] ?? 'User');
                $desc = "User logged into active session: " . ($decodedOut['full_name'] ?? $data['username']);
                break;

            case 'admitPatient':
                $actionType = 'ADMIT';
                $module = 'Admissions & Beds';
                $ref = 'ADM-' . str_pad($decodedOut['admission_id'] ?? ($data['patient_id'] ?? 0), 3, '0', STR_PAD_LEFT);
                $desc = "Admitted patient ID #" . ($data['patient_id'] ?? '') . " — Chief Complaint: " . ($data['chief_complaint'] ?? '');
                break;

            case 'transferBed':
                $actionType = 'TRANSFER';
                $module = 'Admissions & Beds';
                $ref = 'ADM-' . str_pad($data['admission_id'] ?? 0, 3, '0', STR_PAD_LEFT);
                $desc = "Transferred patient to Bed ID #" . ($data['new_bed_id'] ?? '') . " for Admission " . $ref;
                break;

            case 'dischargePatient':
                $actionType = 'DISCHARGE';
                $module = 'Admissions & Beds';
                $ref = 'ADM-' . str_pad($data['admission_id'] ?? 0, 3, '0', STR_PAD_LEFT);
                $desc = "Clinically discharged patient for Admission $ref — Final Diagnosis: " . ($data['diagnosis'] ?? 'Recorded');
                break;

            case 'updateDiagnosis':
                $actionType = 'UPDATE';
                $module = 'Admissions & Beds';
                $ref = 'ADM-' . str_pad($data['admission_id'] ?? 0, 3, '0', STR_PAD_LEFT);
                $desc = "Updated clinical Diagnosis for Admission $ref: " . ($data['diagnosis'] ?? 'Cleared');
                break;

            case 'insertPatient':
            case 'updatePatient':
                $actionType = ($op === 'insertPatient') ? 'CREATE' : 'UPDATE';
                $module = 'Patients Directory';
                $ref = isset($data['patient_id']) ? 'PAT-' . str_pad($data['patient_id'], 3, '0', STR_PAD_LEFT) : 'PAT-NEW';
                $desc = ($op === 'insertPatient' ? "Registered new patient: " : "Updated patient record: ") . ($data['first_name'] ?? '') . " " . ($data['last_name'] ?? '');
                break;

            case 'insertDoctor':
            case 'updateDoctor':
                $actionType = ($op === 'insertDoctor') ? 'CREATE' : 'UPDATE';
                $module = 'Doctors & Fees';
                $ref = isset($data['doctor_id']) ? 'DOC-' . str_pad($data['doctor_id'], 3, '0', STR_PAD_LEFT) : 'DOC-NEW';
                $desc = ($op === 'insertDoctor' ? "Registered new doctor: Dr. " : "Updated doctor profile: Dr. ") . ($data['first_name'] ?? '') . " " . ($data['last_name'] ?? '');
                break;

            case 'insertRoom':
            case 'updateRoom':
                $actionType = ($op === 'insertRoom') ? 'CREATE' : 'UPDATE';
                $module = 'Rooms & Beds';
                $ref = $data['room_name'] ?? 'ROOM';
                $desc = ($op === 'insertRoom' ? "Added new hospital room: " : "Updated hospital room: ") . ($data['room_name'] ?? '');
                break;

            case 'insertCatalog':
            case 'updateCatalog':
                $actionType = ($op === 'insertCatalog') ? 'CREATE' : 'UPDATE';
                $module = 'Charge Catalogs';
                $ref = ($data['code_prefix'] ?? 'CAT') . '-' . str_pad($data['catalog_id'] ?? 0, 3, '0', STR_PAD_LEFT);
                $desc = ($op === 'insertCatalog' ? "Created catalog item: " : "Updated catalog item: ") . ($data['item_name'] ?? '') . " (PHP " . ($data['unit_price'] ?? 0) . ")";
                break;

            case 'insertDiscount':
            case 'updateDiscount':
                $actionType = ($op === 'insertDiscount') ? 'CREATE' : 'UPDATE';
                $module = 'Billing Discounts';
                $ref = isset($data['discount_id']) ? 'DISC-' . $data['discount_id'] : 'DISC-NEW';
                $desc = ($op === 'insertDiscount' ? "Created discount policy: " : "Updated discount policy: ") . ($data['discount_name'] ?? '') . " (" . ($data['discount_percentage'] ?? 0) . "%)";
                break;

            case 'createDoctorOrder':
                $actionType = 'ORDER';
                $module = 'Clinical Orders';
                $ref = 'ADM-' . str_pad($data['admission_id'] ?? 0, 3, '0', STR_PAD_LEFT);
                $desc = "Created & administered clinical order (Catalog ID #" . ($data['catalog_id'] ?? '') . ", Qty: " . ($data['quantity'] ?? 1) . ") for $ref";
                break;

            case 'logDoctorRound':
                $actionType = 'ROUND';
                $module = 'Clinical Orders';
                $ref = 'ADM-' . str_pad($data['admission_id'] ?? 0, 3, '0', STR_PAD_LEFT);
                $desc = "Logged doctor round (Doctor ID #" . ($data['doctor_id'] ?? '') . ", Fee: PHP " . ($data['charged_fee'] ?? 0) . ") for $ref";
                break;

            case 'returnMedicine':
                $actionType = 'RETURN';
                $module = 'Billing & Ledger';
                $ref = 'ADM-' . str_pad($data['admission_id'] ?? 0, 3, '0', STR_PAD_LEFT);
                $desc = "Processed pharmacy medicine return (Qty: " . ($data['return_quantity'] ?? 1) . ") for Admission $ref";
                break;

            case 'settleInvoice':
                $actionType = 'BILLING';
                $module = 'Billing & Settlement';
                $ref = 'INV-' . str_pad($decodedOut['invoice_id'] ?? ($data['admission_id'] ?? 0), 4, '0', STR_PAD_LEFT);
                $desc = "Settled Final Invoice $ref for Admission ADM-" . str_pad($data['admission_id'] ?? 0, 3, '0', STR_PAD_LEFT);
                break;

            case 'toggleStatus':
                $isActive = ($data['is_active'] ?? 0) == 1;
                $actionType = $isActive ? 'RESTORE' : 'ARCHIVE';
                $module = 'System Archive';
                $scriptName = basename($_SERVER['SCRIPT_NAME'], '.php');
                $ref = strtoupper(substr($scriptName, 0, 3)) . '-' . ($data['patient_id'] ?? $data['doctor_id'] ?? $data['room_id'] ?? $data['catalog_id'] ?? $data['discount_id'] ?? '');
                $desc = ($isActive ? "Restored record to active status" : "Moved record to System Archive") . " ($scriptName: $ref)";
                break;

            case 'restoreRecord':
                $actionType = 'RESTORE';
                $module = 'System Archive';
                $ref = strtoupper($data['entity'] ?? 'REC') . '-' . ($data['id'] ?? '');
                $desc = "Restored archived " . ($data['entity'] ?? 'record') . " (ID #" . ($data['id'] ?? '') . ") back to active use";
                break;

            case 'hardDeleteRecord':
                $actionType = 'DELETE';
                $module = 'System Archive';
                $ref = strtoupper($data['entity'] ?? 'REC') . '-' . ($data['id'] ?? '');
                $desc = "Permanently deleted " . ($data['entity'] ?? 'record') . " (ID #" . ($data['id'] ?? '') . ") from database";
                break;
        }

        $userId = $data['user_id'] ?? $data['processed_by_user_id'] ?? $decodedOut['user_id'] ?? 1;
        $admissionId = $decodedOut['admission_id'] ?? $data['admission_id'] ?? null;

        try {
            $stmt = $conn->prepare("INSERT INTO Audit_Log (User_ID, Admission_ID, Action_Type, Module_Name, Record_Reference, Description, Performed_By) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$userId, $admissionId, $actionType, $module, $ref, $desc, $by]);
        } catch (Exception $e) {
            // Ignore audit logging errors
        }
    });
}
?>
