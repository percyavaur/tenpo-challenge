import type { IUser } from "../models/User";

const fakeLoginService: (
  email: string,
  password: string
) => Promise<{
  status: number;
  token: string;
  user: IUser;
}> = (email: string, password: string) => {
  console.log("login with: ", email, password);
  return new Promise<{ status: number; token: string; user: IUser }>(
    (resolve) => {
      setTimeout(
        () =>
          resolve({
            status: 200,
            token: "lorem-ipsum-dolor-sit-amet",
            user: {
              id: "abc123",
              name: "John Doe",
              email: "john.doe@test.com",
            },
          }),
        2000
      );
    }
  );
};

const authServices = {
  fakeLoginService,
};

export default authServices;
