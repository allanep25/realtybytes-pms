import { prisma } from "@/lib/db";

export type ShiftNoteItem = {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
};

export async function getRecentShiftNotes(limit = 8): Promise<ShiftNoteItem[]> {
  const notes = await prisma.shiftNote.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { author: { select: { name: true } } },
  });

  return notes.map((note) => ({
    id: note.id,
    content: note.content,
    authorName: note.author.name,
    createdAt: note.createdAt.toISOString(),
  }));
}

export async function addShiftNote(content: string, authorId: string) {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Note cannot be empty");

  const note = await prisma.shiftNote.create({
    data: { content: trimmed, authorId },
    include: { author: { select: { name: true } } },
  });

  return {
    id: note.id,
    content: note.content,
    authorName: note.author.name,
    createdAt: note.createdAt.toISOString(),
  };
}
