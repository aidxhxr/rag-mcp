import { connectToDatabase } from "@/database/mongoose";
import { CreateBook, TextSegment } from "@/types";
import { generateSlug, serializeData } from "@/lib/utils";
import { Book } from "@/database/models/book.model";
import BookSegment from "@/database/models/book-segment.model";

export const createBook = async (data: CreateBook) => {
  try {
    await connectToDatabase();
    const slug = generateSlug(data.title);
    const existingBook = await Book.findOne({ slug }).lean();
    if (existingBook) {
      return {
        success: true,
        data: serializeData(existingBook),
        alreadyExists: true,
      };
    }
    // TODO: check subscription limits
    const book = await Book.create({ ...data, slug, totalSegments: 0 });
  } catch (e) {
    console.error("Error creating a book", e);
    return { success: false, error: e };
  }
};

export const saveBookSegments = async (
  bookId: string,
  clerkId: string,
  segments: TextSegment[],
) => {
  try {
    await connectToDatabase();
    console.log("Saving book segments...");
    const segmentsToInsert = segments.map(({ text, segmentIndex, pageNumber, wordCount }) => ({
      clerkId, bookId, content: text, segmentIndex, pageNumber, wordCount
    }));
    await BookSegment.insertMany(segmentsToInsert);
    await Book.findByIdAndUpdate(bookId, { totalSegments: segmentsToInsert.length });
  } catch (e) {
    console.log("Error saving book segments", e);
    await BookSegment.deleteMany({ bookId });
    await Book.findByAndDelete(bookId);
    console.log(
      "Deleted book segments and book due to failure to save segments",
    );
  }
};
