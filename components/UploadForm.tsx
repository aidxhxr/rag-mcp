"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Upload, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const VOICES = {
  male: [
    {
      id: "dave",
      name: "Dave",
      description: "Young male, British-Essex, casual & conversational",
    },
    {
      id: "daniel",
      name: "Daniel",
      description: "Middle-aged male, British, authoritative but warm",
    },
    { id: "chris", name: "Chris", description: "Male, casual & easy-going" },
  ],
  female: [
    {
      id: "rachel",
      name: "Rachel",
      description: "Young female, American, calm & clear",
    },
    {
      id: "sarah",
      name: "Sarah",
      description: "Young female, American, soft & approachable",
    },
  ],
} as const;

type VoiceId = "dave" | "daniel" | "chris" | "rachel" | "sarah";

const formSchema = z.object({
  pdf: z
    .instanceof(File, { message: "Please upload a PDF file." })
    .refine((f) => f.type === "application/pdf", "Only PDF files are accepted.")
    .refine((f) => f.size <= 50 * 1024 * 1024, "File must be 50MB or smaller."),
  coverImage: z.instanceof(File).optional(),
  title: z.string().min(1, "Title is required."),
  authorName: z.string().min(1, "Author name is required."),
  voice: z.enum(["dave", "daniel", "chris", "rachel", "sarah"] as const),
});

type FormValues = z.infer<typeof formSchema>;

interface UploadFormProps {
  booksUsed?: number;
  booksLimit?: number;
}

const UploadForm = ({ booksUsed = 5, booksLimit = 10 }: UploadFormProps) => {
  const [pdfName, setPdfName] = React.useState<string | null>(null);
  const [coverName, setCoverName] = React.useState<string | null>(null);
  const pdfInputRef = React.useRef<HTMLInputElement>(null);
  const coverInputRef = React.useRef<HTMLInputElement>(null);

  function triggerOnKey(
    ref: React.RefObject<HTMLInputElement | null>,
    e: React.KeyboardEvent,
  ) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      ref.current?.click();
    }
  }

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { voice: "rachel" },
  });

  function onSubmit(data: FormValues) {
    console.log("Form submitted:", data);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="w-full max-w-2xl mx-auto flex flex-col gap-6"
    >
      {/* Books usage */}
      <p className="text-sm text-[#6b7a8d]">
        {booksUsed} of {booksLimit} books used{" "}
        <button
          type="button"
          className="text-[#9c6030] hover:underline font-medium"
        >
          (Upgrade)
        </button>
      </p>

      {/* PDF Upload */}
      <div className="flex flex-col gap-2">
        <label className="text-base font-semibold text-[#212a3b]">
          Book PDF File
        </label>
        <Controller
          name="pdf"
          control={control}
          render={({ field: { onChange, ...field } }) => (
            <label
              tabIndex={0}
              onKeyDown={(e) => triggerOnKey(pdfInputRef, e)}
              className={cn(
                "flex flex-col items-center justify-center gap-2 w-full rounded-xl border border-[rgba(33,42,59,0.15)] bg-white cursor-pointer py-10 transition-colors hover:bg-[#fafaf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(33,42,59,0.4)] focus-visible:ring-offset-2",
                errors.pdf && "border-red-400",
              )}
            >
              <input
                {...field}
                ref={pdfInputRef}
                value={undefined}
                type="file"
                accept=".pdf,application/pdf"
                tabIndex={-1}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.type !== "application/pdf") {
                    e.target.value = "";
                    return;
                  }
                  onChange(file);
                  setPdfName(file.name);
                }}
              />
              <Upload className="size-9 text-[#9c8060] stroke-[1.5]" />
              <span className="text-sm text-[#5a6070]">
                {pdfName ? pdfName : "Click to upload PDF"}
              </span>
              {!pdfName && (
                <span className="text-xs text-[#8a9098]">
                  PDF file (max 50MB)
                </span>
              )}
            </label>
          )}
        />
        {errors.pdf && (
          <p className="text-xs text-red-500">{errors.pdf.message}</p>
        )}
      </div>

      {/* Cover Image Upload */}
      <div className="flex flex-col gap-2">
        <label className="text-base font-semibold text-[#212a3b]">
          Cover Image (Optional)
        </label>
        <Controller
          name="coverImage"
          control={control}
          render={({ field: { onChange, ...field } }) => (
            <label
              tabIndex={0}
              onKeyDown={(e) => triggerOnKey(coverInputRef, e)}
              className="flex flex-col items-center justify-center gap-2 w-full rounded-xl border border-[rgba(33,42,59,0.15)] bg-white cursor-pointer py-10 transition-colors hover:bg-[#fafaf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(33,42,59,0.4)] focus-visible:ring-offset-2"
            >
              <input
                {...field}
                ref={coverInputRef}
                value={undefined}
                type="file"
                accept="image/*"
                tabIndex={-1}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onChange(file);
                    setCoverName(file.name);
                  }
                }}
              />
              <ImageIcon className="size-9 text-[#9c8060] stroke-[1.5]" />
              <span className="text-sm text-[#5a6070]">
                {coverName ? coverName : "Click to upload cover image"}
              </span>
              {!coverName && (
                <span className="text-xs text-[#8a9098]">
                  Leave empty to auto-generate from PDF
                </span>
              )}
            </label>
          )}
        />
      </div>

      {/* Title */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="book-title"
          className="text-base font-semibold text-[#212a3b]"
        >
          Title
        </label>
        <Controller
          name="title"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              id="book-title"
              placeholder="ex: Rich Dad Poor Dad"
              className={cn(
                "w-full rounded-xl border border-[rgba(33,42,59,0.15)] bg-white px-4 py-3 text-sm text-[#212a3b] placeholder:text-[#9ca3af] outline-none focus:border-[rgba(33,42,59,0.4)] focus:ring-2 focus:ring-[rgba(33,42,59,0.08)] transition-colors",
                errors.title && "border-red-400",
              )}
            />
          )}
        />
        {errors.title && (
          <p className="text-xs text-red-500">{errors.title.message}</p>
        )}
      </div>

      {/* Author Name */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="author-name"
          className="text-base font-semibold text-[#212a3b]"
        >
          Author Name
        </label>
        <Controller
          name="authorName"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              id="author-name"
              placeholder="ex: Robert Kiyosaki"
              className={cn(
                "w-full rounded-xl border border-[rgba(33,42,59,0.15)] bg-white px-4 py-3 text-sm text-[#212a3b] placeholder:text-[#9ca3af] outline-none focus:border-[rgba(33,42,59,0.4)] focus:ring-2 focus:ring-[rgba(33,42,59,0.08)] transition-colors",
                errors.authorName && "border-red-400",
              )}
            />
          )}
        />
        {errors.authorName && (
          <p className="text-xs text-red-500">{errors.authorName.message}</p>
        )}
      </div>

      {/* Voice Selection */}
      <div className="flex flex-col gap-4">
        <p className="text-base font-semibold text-[#212a3b]">
          Choose Assistant Voice
        </p>

        <Controller
          name="voice"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-4">
              {/* Male Voices */}
              <div className="flex flex-col gap-2">
                <p className="text-sm text-[#6b7a8d]">Male Voices</p>
                <div className="grid grid-cols-3 gap-3">
                  {VOICES.male.map((voice) => {
                    const selected = field.value === voice.id;
                    return (
                      <label
                        key={voice.id}
                        className={cn(
                          "flex flex-col gap-1.5 rounded-xl border p-4 cursor-pointer transition-colors",
                          selected
                            ? "border-[#9c6030] bg-[#fdf5e8]"
                            : "border-[rgba(33,42,59,0.15)] bg-white hover:bg-[#fafaf8]",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="voice"
                            value={voice.id}
                            checked={selected}
                            onChange={() =>
                              setValue("voice", voice.id as VoiceId)
                            }
                            className="accent-[#9c6030] size-4 shrink-0"
                          />
                          <span className="text-sm font-semibold text-[#212a3b]">
                            {voice.name}
                          </span>
                        </div>
                        <p className="text-xs text-[#6b7a8d] leading-snug pl-6">
                          {voice.description}
                        </p>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Female Voices */}
              <div className="flex flex-col gap-2">
                <p className="text-sm text-[#6b7a8d]">Female Voices</p>
                <div className="grid grid-cols-2 gap-3">
                  {VOICES.female.map((voice) => {
                    const selected = field.value === voice.id;
                    return (
                      <label
                        key={voice.id}
                        className={cn(
                          "flex flex-col gap-1.5 rounded-xl border p-4 cursor-pointer transition-colors",
                          selected
                            ? "border-[#9c6030] bg-[#fdf5e8]"
                            : "border-[rgba(33,42,59,0.15)] bg-white hover:bg-[#fafaf8]",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="voice"
                            value={voice.id}
                            checked={selected}
                            onChange={() =>
                              setValue("voice", voice.id as VoiceId)
                            }
                            className="accent-[#9c6030] size-4 shrink-0"
                          />
                          <span className="text-sm font-semibold text-[#212a3b]">
                            {voice.name}
                          </span>
                        </div>
                        <p className="text-xs text-[#6b7a8d] leading-snug pl-6">
                          {voice.description}
                        </p>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="w-full rounded-xl bg-[#3d1a0e] py-4 text-base font-semibold text-white transition-colors hover:bg-[#4e2210] active:bg-[#2d1008]"
      >
        Begin Synthesis
      </button>
    </form>
  );
};

export default UploadForm;
