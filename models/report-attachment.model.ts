import { Archive } from "./archive.model";
import { PatientReport } from "./patient-report.model";

export interface ReportAttachment {
    id: number,
    report_id: number,
    archive_id: number,
    name: string,
    report?: PatientReport,
    archive?: Archive,
}
