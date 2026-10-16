import { User } from "../../core/models/user.model";
import { Professional } from "./professional.model";

export interface TfdUser extends User {
    professional?: Professional;
}
