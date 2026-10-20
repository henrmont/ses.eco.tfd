import { PatientRequestCostAssistance } from "./patient-request-cost-assistance.model";
import { PatientRequest } from "./patient-request.model";

export interface Payment {
    id?: number,
    cost_assistance_id?: number,
    name?: string,
    description?: string,
    cost_assistance?: PatientRequestCostAssistance,
    status?: boolean,
    is_payment_bookmark?: boolean,
    patient_request?: PatientRequest,
    sigadoc?: string,
    creditor?: string,
    document_number?: string
}
