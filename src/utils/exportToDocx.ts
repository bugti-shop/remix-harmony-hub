import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx';
import { Note } from '@/types/note';
import { saveAs } from 'file-saver';

export const exportNoteToDocx = async (note: Note) => {
  const sections: any[] = [];

  // Title
  sections.push(
    new Paragraph({
      text: note.title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    })
  );

  // Date
  sections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Created: ${new Date(note.createdAt).toLocaleDateString()}`,
          italics: true,
          size: 20,
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // Content based on note type
  switch (note.type) {
    case 'sticky':
    case 'lined':
    case 'regular':
      // Regular text content
      const contentParagraphs = note.content.split('\n').map(
        (line) =>
          new Paragraph({
            children: [new TextRun(line || ' ')],
            spacing: { after: 100 },
          })
      );
      sections.push(...contentParagraphs);
      break;

    case 'code':
      // Code content
      if (note.codeContent) {
        const codeParagraphs = note.codeContent.split('\n').map(
          (line) =>
            new Paragraph({
              children: [new TextRun({ text: line || ' ', font: 'Courier New' })],
              spacing: { after: 50 },
            })
        );
        sections.push(...codeParagraphs);
      }
      break;


  }

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: sections,
      },
    ],
  });

  // Generate and download
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${note.title || 'note'}.docx`);
};
