import { Schema, model, models } from "mongoose";
import { IVoiceSession } from "@/types";

const VoiceSessionSchema = new Schema<IVoiceSession>(
  {
    clerkId: { type: String, required: true },
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date },
    durationSeconds: { type: Number, default: 0 },
    billingPeriodStart: { type: Date, required: true },
  },
  { timestamps: true },
);

const VoiceSession =
  models.VoiceSession ||
  model<IVoiceSession>("VoiceSession", VoiceSessionSchema);

export default VoiceSession;
