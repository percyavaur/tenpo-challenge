import api from "../core/axiosAgent";
import type { ISubjectResponse } from "../models/Library";

const fetchBooks = ({
  subject,
  limit,
  offset,
}: {
  subject: string;
  limit: number;
  offset: number;
}) => {
  return api.get<ISubjectResponse>(`/subjects/${subject}.json`, {
    params: { limit, offset },
  });
};

const libraryServices = {
  fetchBooks,
};

export default libraryServices;
