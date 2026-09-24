import { ProfessionalType } from "./professional-type.model";
import { User } from "./user.model";

export interface Professional {
    id: number,
    user_id: number,
    name: string,
    cns: string,
    registration: string,
    professional_register?: string,
    cbo?: string,
    user: User,
    types: ProfessionalType[] | null
}
