import { getAllUsers } from "../src/lib/api";

const users = await getAllUsers();
console.log(users);
