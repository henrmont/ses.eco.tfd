import { AccountabilityDaily } from "./accountability-daily.model";
import { PatientRequest } from "./patient-request.model";

export interface PatientRequestAccountability {
    id: number,
    patient_request_id: number,
    name: string,
    status: boolean,
    patient_request?: PatientRequest,
    accountability_dailies?: AccountabilityDaily[],
    total_dailies?: number,
    total_amount?: number,
    dailies?: any
}
