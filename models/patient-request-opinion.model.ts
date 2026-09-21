export interface PatientRequestOpinion {
    id: number,
    patient_request_id: number,
    professional_id: number,
    name: string,
    content: string,
    is_approved: boolean,
    my_opinion: boolean,
}
