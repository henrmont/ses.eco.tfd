import { Archive } from "./archive.model";
import { PatientRequest } from "./patient-request.model";

export interface PatientRequestAttachment {
    id: number,
    patient_request_id: number,
    archive_id: number,
    name: string,
    patient_request?: PatientRequest,
    archive?: Archive,
}
