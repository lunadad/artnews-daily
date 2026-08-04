import { z } from "zod";

export const CategorySchema = z.enum(["market", "museum", "fair", "artist", "general"]);
export type Category = z.infer<typeof CategorySchema>;

export const NewsItemSchema = z.object({
  id: z.string().min(1),
  rank: z.number().int().positive(),
  score: z.number().nonnegative(),
  category: CategorySchema,
  titleOriginal: z.string().min(1),
  titleKo: z.string().min(1),
  summaryKo: z.string(),
  url: z.url(),
  source: z.string().min(1),
  sourceDomain: z.string().min(1),
  discoveredVia: z.enum(["direct", "google"]),
  resolved: z.boolean(),
  publishedAt: z.iso.datetime(),
  coverage: z.number().int().positive(),
  image: z.url().nullable(),
  imageWidth: z.number().int().positive().nullable(),
  imageHeight: z.number().int().positive().nullable(),
});
export type NewsItem = z.infer<typeof NewsItemSchema>;

export const BriefingSchema = z.object({
  headline: z.string().min(1),
  distribution: z.record(CategorySchema, z.number().int().nonnegative()),
  focus: z.array(z.object({ title: z.string().min(1), why: z.string().min(1) })).max(3),
});
export type Briefing = z.infer<typeof BriefingSchema>;

export const DomesticItemSchema = z.object({
  rank: z.number().int().positive(),
  score: z.number().nonnegative(),
  category: CategorySchema,
  title: z.string().min(1),
  summary: z.string(),
  url: z.url(),
  source: z.string().min(1),
  publishedAt: z.iso.datetime(),
  coverage: z.number().int().positive(),
  qualityCoverage: z.number().int().nonnegative().optional(),
  resolved: z.boolean(),
});
export type DomesticItem = z.infer<typeof DomesticItemSchema>;

export const DomesticDataSchema = z.object({
  headline: z.string().min(1),
  distribution: z.record(CategorySchema, z.number().int().nonnegative()),
  items: z.array(DomesticItemSchema).max(5),
});
export type DomesticData = z.infer<typeof DomesticDataSchema>;

export const KarinaItemSchema = z.object({
  rank: z.number().int().positive(),
  titleKo: z.string().min(1),
  titleOriginal: z.string().min(1),
  summaryKo: z.string(),
  url: z.url(),
  source: z.string().min(1),
  category: CategorySchema,
  image: z.url().nullable(),
});
export type KarinaItem = z.infer<typeof KarinaItemSchema>;

export const KarinaDataSchema = z.object({
  date: z.iso.date(),
  generatedAt: z.iso.datetime({ offset: true }),
  items: z.array(KarinaItemSchema).max(4),
});
export type KarinaData = z.infer<typeof KarinaDataSchema>;

export const DailyDataSchema = z.object({
  date: z.iso.date(),
  generatedAt: z.iso.datetime({ offset: true }),
  briefing: BriefingSchema,
  domestic: DomesticDataSchema.optional(),
  top5: z.array(NewsItemSchema).max(5),
  karina: KarinaDataSchema.nullable(),
  partial: z.boolean().optional(),
});
export type DailyData = z.infer<typeof DailyDataSchema>;

export const DataIndexSchema = z.object({ dates: z.array(z.iso.date()).max(7) });
