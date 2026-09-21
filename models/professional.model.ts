import { User } from "./user.model";

export interface Professional {
    id: number,
    user_id: number,
    name: string,
    type: string,
    cns: string,
    registration: string,
    professional_register?: string,
    cbo?: string,
    user: User
}
