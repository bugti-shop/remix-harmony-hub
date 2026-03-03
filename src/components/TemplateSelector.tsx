import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, Lightbulb, ClipboardList } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  icon: any;
  content: string;
  description: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'meeting',
    name: 'Meeting Notes',
    icon: Calendar,
    description: 'Structured template for meeting minutes',
    content: `<h2>Meeting Notes</h2>
<p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
<p><strong>Attendees:</strong> </p>
<p><strong>Agenda:</strong></p>
<ul>
  <li></li>
</ul>
<p><strong>Discussion Points:</strong></p>
<ul>
  <li></li>
</ul>
<p><strong>Action Items:</strong></p>
<ul>
  <li></li>
</ul>
<p><strong>Next Meeting:</strong> </p>`,
  },
  {
    id: 'project',
    name: 'Project Planning',
    icon: ClipboardList,
    description: 'Organize project goals and tasks',
    content: `<h2>Project Plan</h2>
<p><strong>Project Name:</strong> </p>
<p><strong>Start Date:</strong> ${new Date().toLocaleDateString()}</p>
<p><strong>Project Goals:</strong></p>
<ul>
  <li></li>
</ul>
<p><strong>Key Milestones:</strong></p>
<ul>
  <li></li>
</ul>
<p><strong>Resources Needed:</strong></p>
<ul>
  <li></li>
</ul>
<p><strong>Timeline:</strong></p>
<ul>
  <li></li>
</ul>
<p><strong>Success Criteria:</strong></p>
<ul>
  <li></li>
</ul>`,
  },
  {
    id: 'journal',
    name: 'Daily Journal',
    icon: FileText,
    description: 'Reflect on your day',
    content: `<h2>Daily Journal - ${new Date().toLocaleDateString()}</h2>
<p><strong>How I'm feeling today:</strong></p>
<p></p>
<p><strong>Three things I'm grateful for:</strong></p>
<ol>
  <li></li>
  <li></li>
  <li></li>
</ol>
<p><strong>Today's highlights:</strong></p>
<p></p>
<p><strong>Challenges faced:</strong></p>
<p></p>
<p><strong>Tomorrow's focus:</strong></p>
<p></p>`,
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    icon: Lightbulb,
    description: 'Capture and organize ideas',
    content: `<h2>Brainstorm Session</h2>
<p><strong>Topic:</strong> </p>
<p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
<p><strong>Initial Ideas:</strong></p>
<ul>
  <li></li>
</ul>
<p><strong>Promising Concepts:</strong></p>
<ul>
  <li></li>
</ul>
<p><strong>Next Steps:</strong></p>
<ul>
  <li></li>
</ul>`,
  },
];

interface TemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (content: string) => void;
}

export const TemplateSelector = ({ isOpen, onClose, onSelectTemplate }: TemplateSelectorProps) => {
  const handleSelect = (template: Template) => {
    onSelectTemplate(template.content);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose a Template</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-4">
          {TEMPLATES.map((template) => {
            const Icon = template.icon;
            return (
              <Button
                key={template.id}
                variant="outline"
                className="h-auto flex flex-col items-center gap-2 p-4 hover:bg-accent"
                onClick={() => handleSelect(template)}
              >
                <Icon className="h-6 w-6" />
                <span className="font-medium">{template.name}</span>
                <span className="text-xs text-muted-foreground text-center">
                  {template.description}
                </span>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
