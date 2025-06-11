import React from "react";
import type { IBook } from "../../../models/Library";

interface IProps {
  books: IBook[];
}

const BooksTableComponent: React.FC<IProps> = ({ books }) => {
  const getAuthors = (book: IBook) => {
    return book.authors.map((a) => a.name).join(", ");
  };
  return (
    <div className="text-gray-900 dark:text-gray-100 w-full">
      <div className="border border-gray-400 dark:border-gray-500 border-solid rounded-md">
        <table className="w-full">
          <thead className="bg-gray-500 h-[48px]">
            <tr>
              <th className="pl-4 text-left">Título</th>
              <th className="pl-4 text-left">Autor(es)</th>
              <th className="pl-4 text-left w-[150px]">Ediciones</th>
            </tr>
          </thead>
          <tbody>
            {books.map((book, i) => (
              <tr
                key={book.key}
                className={`h-[48px] ${
                  i + 1 < books.length && "border-b border-gray-500"
                } `}
              >
                <td className="py-2 px-4">{book.title}</td>
                <td className="py-2 px-4 max-w-[350px] truncate">
                  {getAuthors(book)}
                </td>
                <td className="py-2 px-4">{book.edition_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BooksTableComponent;
