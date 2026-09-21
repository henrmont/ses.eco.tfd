import { PatientRequestCostAssistance } from "./patient-request-cost-assistance.model";

export interface Payment {
    id?: number,
    cost_assistance_id?: number,
    name?: string,
    description?: string,
    cost_assistance?: PatientRequestCostAssistance,
    status?: boolean
}
