import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { toast } from 'sonner';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import {
  BookOpen, Briefcase, GraduationCap, Heart, Utensils, FileText,
  Search, Plus, Trash2, ChevronRight, X, Star, LayoutTemplate,
  Notebook, Receipt, Calendar, Lightbulb, Globe, Dumbbell
} from 'lucide-react';
import { Note, NoteType, Folder } from '@/types/note';

// ─── Types ───

export interface NoteTemplateDef {
  title: string;
  type: NoteType;
  content: string;
}

export interface NoteTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  folderColor: string;
  notes: NoteTemplateDef[];
  isCustom?: boolean;
}

// ─── Icon map ───
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen, Briefcase, GraduationCap, Heart, Utensils, FileText,
  Star, LayoutTemplate, Notebook, Receipt, Calendar, Lightbulb, Globe, Dumbbell,
};
const ICON_OPTIONS = Object.keys(ICON_MAP);

// ─── Built-in templates ───

const DEFAULT_NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'meeting-pack',
    name: 'Meeting Notes Pack',
    icon: 'Calendar',
    description: 'Ready-to-use meeting notes with agenda, action items, and follow-up templates',
    category: 'Work',
    folderColor: '#3b82f6',
    notes: [
      {
        title: 'Weekly Team Standup',
        type: 'regular',
        content: `<h2>Weekly Team Standup</h2>
<p><strong>Date:</strong> February 10, 2025</p>
<p><strong>Attendees:</strong> Sarah Chen, Mark Rivera, Priya Patel, James Okoro</p>
<hr/>
<h3>Agenda</h3>
<ul><li>Progress updates from each team member</li><li>Blockers and challenges</li><li>Upcoming priorities</li></ul>
<h3>Discussion Notes</h3>
<table><thead><tr><th>Person</th><th>Update</th><th>Blockers</th></tr></thead><tbody><tr><td>Sarah Chen</td><td>Completed API integration for payments module</td><td>Waiting on design approval for checkout flow</td></tr><tr><td>Mark Rivera</td><td>Deployed staging environment, running QA tests</td><td>None</td></tr><tr><td>Priya Patel</td><td>Finalized onboarding wireframes</td><td>Need copy from marketing team</td></tr></tbody></table>
<h3>Action Items</h3>
<ul><li><strong>Sarah Chen</strong> — Follow up with design team on checkout mockups — <em>Due: Feb 12</em></li><li><strong>James Okoro</strong> — Schedule stakeholder demo for Friday — <em>Due: Feb 14</em></li></ul>
<h3>Next Meeting</h3>
<p>Date: February 17, 2025 | Time: 10:00 AM</p>`,
      },
      {
        title: 'Client Meeting Notes',
        type: 'regular',
        content: `<h2>Client Meeting Notes</h2>
<p><strong>Client:</strong> Meridian Solutions</p>
<p><strong>Date:</strong> February 8, 2025 | <strong>Duration:</strong> 45 minutes</p>
<hr/>
<h3>Objectives</h3>
<ol><li>Discuss project progress</li><li>Review deliverables</li><li>Address client feedback</li></ol>
<h3>Key Discussions</h3>
<p>Reviewed the updated dashboard designs. Client expressed interest in adding a real-time analytics widget. Discussed timeline implications and agreed to a phased rollout approach.</p>
<h3>Client Feedback</h3>
<blockquote><p>"The new navigation feels much more intuitive. We'd love to see the reporting section expanded with export capabilities."</p></blockquote>
<h3>Deliverables Status</h3>
<table><thead><tr><th>Deliverable</th><th>Status</th><th>ETA</th><th>Notes</th></tr></thead><tbody><tr><td>Design mockups</td><td>Complete</td><td>-</td><td>Approved with minor revisions</td></tr><tr><td>Development</td><td>In Progress</td><td>March 1</td><td>Backend API 80% done</td></tr><tr><td>Testing</td><td>Pending</td><td>March 10</td><td>QA plan drafted</td></tr></tbody></table>
<h3>Next Steps</h3>
<ul><li>Follow up on feedback by Feb 15</li><li>Send updated proposal with analytics widget scope</li><li>Schedule next check-in for Feb 22</li></ul>`,
      },
      {
        title: 'Meeting Follow-Up Email Draft',
        type: 'regular',
        content: `<h2>Meeting Follow-Up Email</h2>
<p><strong>To:</strong> Laura Kim, David Nguyen</p>
<p><strong>Subject:</strong> Follow-up: Q1 Product Roadmap Review - Feb 8</p>
<hr/>
<p>Hi Laura,</p>
<p>Thank you for taking the time to meet today. Here's a summary of what we discussed:</p>
<h3>Key Takeaways</h3>
<ol><li>Prioritize mobile responsiveness for the March release</li><li>Postpone the advanced filtering feature to Q2</li><li>Allocate additional budget for user research in February</li></ol>
<h3>Action Items</h3>
<table><thead><tr><th>Owner</th><th>Action</th><th>Deadline</th></tr></thead><tbody><tr><td>Laura Kim</td><td>Share updated wireframes for mobile views</td><td>Feb 14</td></tr><tr><td>David Nguyen</td><td>Finalize API documentation for v2 endpoints</td><td>Feb 18</td></tr></tbody></table>
<p>Please let me know if I've missed anything. Looking forward to our next meeting on February 22.</p>
<p>Best regards,<br/>Alex Thompson</p>`,
      },
    ],
  },
  {
    id: 'study-notes',
    name: 'Study Notes Collection',
    icon: 'GraduationCap',
    description: 'Cornell notes, flashcard lists, and study planners for effective learning',
    category: 'Education',
    folderColor: '#8b5cf6',
    notes: [
      {
        title: 'Cornell Notes Template',
        type: 'regular',
        content: `<h2>Cornell Notes</h2>
<p><strong>Subject:</strong> Biology 101 | <strong>Date:</strong> Feb 10, 2025 | <strong>Topic:</strong> Cell Division and Mitosis</p>
<hr/>
<table><thead><tr><th style="width:30%">Cue / Questions</th><th style="width:70%">Notes</th></tr></thead><tbody>
<tr><td><strong>What is mitosis?</strong></td><td>Mitosis is the process of cell division where a single cell divides to produce two identical daughter cells. It consists of four main phases: prophase, metaphase, anaphase, and telophase.</td></tr>
<tr><td><strong>What are the phases?</strong></td><td>The four phases in order:<br/>- Prophase: chromosomes condense, nuclear envelope breaks down<br/>- Metaphase: chromosomes align at the cell equator<br/>- Anaphase: sister chromatids separate and move to poles<br/>- Telophase: nuclear envelopes reform, chromosomes decondense</td></tr>
<tr><td><strong>Why is mitosis important?</strong></td><td>Essential for growth, tissue repair, and asexual reproduction. Errors in mitosis can lead to cancer or genetic disorders.</td></tr>
</tbody></table>
<hr/>
<h3>Summary</h3>
<p>Mitosis is a four-phase process of cell division that produces genetically identical daughter cells. It is critical for organism growth and tissue repair, and errors in the process can have serious consequences including uncontrolled cell growth.</p>
<h3>Questions for Review</h3>
<ul><li>What are the main differences between mitosis and meiosis?</li><li>How does mitosis contribute to wound healing in humans?</li></ul>`,
      },
      {
        title: 'Study Planner',
        type: 'regular',
        content: `<h2>Study Planner</h2>
<p><strong>Exam:</strong> Organic Chemistry Midterm | <strong>Date:</strong> March 5, 2025</p>
<hr/>
<h3>Subjects and Topics</h3>
<table><thead><tr><th>Subject</th><th>Topics to Cover</th><th>Priority</th><th>Status</th></tr></thead><tbody>
<tr><td>Alkanes & Cycloalkanes</td><td>Nomenclature, Conformations, Newman Projections</td><td>High</td><td>Not Started</td></tr>
<tr><td>Stereochemistry</td><td>R/S Configuration, Optical Activity, Fischer Projections</td><td>High</td><td>In Progress</td></tr>
<tr><td>Substitution Reactions</td><td>SN1 vs SN2 Mechanisms, Nucleophilicity</td><td>Medium</td><td>Done</td></tr>
</tbody></table>
<h3>Weekly Schedule</h3>
<table><thead><tr><th>Day</th><th>Morning</th><th>Afternoon</th><th>Evening</th></tr></thead><tbody>
<tr><td><strong>Monday</strong></td><td>Alkanes chapter review</td><td>Practice problems set 4</td><td>Review flashcards</td></tr>
<tr><td><strong>Tuesday</strong></td><td>Stereochemistry lecture notes</td><td>Lab report writing</td><td>Alkanes practice</td></tr>
<tr><td><strong>Wednesday</strong></td><td>Substitution reactions drill</td><td>Study group session</td><td>Weak areas review</td></tr>
</tbody></table>
<h3>Study Goals</h3>
<ul><li>Complete all practice problems by Feb 28</li><li>Review weak areas daily for 30 minutes</li><li>Do at least 2 full-length mock exams</li></ul>`,
      },
      {
        title: 'Flashcard List',
        type: 'regular',
        content: `<h2>Flashcard Review List</h2>
<p><strong>Subject:</strong> World History | <strong>Chapter:</strong> The Renaissance</p>
<hr/>
<table><thead><tr><th style="width:40%">Term / Question</th><th style="width:40%">Answer / Definition</th><th style="width:20%">Confidence</th></tr></thead><tbody>
<tr><td><strong>Renaissance</strong></td><td>A cultural movement spanning the 14th to 17th century, originating in Italy, marking a renewed interest in classical art, science, and philosophy</td><td>High</td></tr>
<tr><td><strong>Humanism</strong></td><td>An intellectual movement emphasizing human potential and achievements, focusing on secular concerns rather than religious doctrine</td><td>Medium</td></tr>
<tr><td><strong>Gutenberg's Press</strong></td><td>Invented around 1440 by Johannes Gutenberg, the movable-type printing press revolutionized the spread of knowledge across Europe</td><td>Low</td></tr>
<tr><td><strong>Machiavelli</strong></td><td>Italian diplomat and author of "The Prince," a political treatise on power and statecraft that separated politics from morality</td><td>High</td></tr>
</tbody></table>
<h3>Review Progress</h3>
<p>Low = Need more practice | Medium = Getting there | High = Confident</p>`,
      },
    ],
  },
  {
    id: 'project-docs',
    name: 'Project Documentation',
    icon: 'Briefcase',
    description: 'PRD, project brief, and retrospective templates for project management',
    category: 'Work',
    folderColor: '#10b981',
    notes: [
      {
        title: 'Project Brief',
        type: 'regular',
        content: `<h2>Project Brief</h2>
<p><strong>Project Name:</strong> Customer Portal Redesign</p>
<p><strong>Owner:</strong> Rachel Martinez | <strong>Start Date:</strong> Jan 15, 2025 | <strong>Target Completion:</strong> April 30, 2025</p>
<hr/>
<h3>Objective</h3>
<p>Redesign the customer self-service portal to improve usability, reduce support ticket volume by 30%, and enable mobile-first access for 60% of users who access via smartphones.</p>
<h3>Scope</h3>
<table><thead><tr><th>In Scope</th><th>Out of Scope</th></tr></thead><tbody>
<tr><td>Dashboard redesign with new metrics</td><td>Internal admin panel changes</td></tr>
<tr><td>Mobile-responsive layouts</td><td>Native mobile app development</td></tr>
<tr><td>Self-service knowledge base integration</td><td>AI chatbot implementation</td></tr>
</tbody></table>
<h3>Stakeholders</h3>
<table><thead><tr><th>Name</th><th>Role</th><th>Responsibility</th></tr></thead><tbody>
<tr><td>Rachel Martinez</td><td>Project Lead</td><td>Overall direction and timeline</td></tr>
<tr><td>Kevin Zhao</td><td>Lead Designer</td><td>UI/UX design and prototyping</td></tr>
<tr><td>Amara Johnson</td><td>Senior Developer</td><td>Frontend and API implementation</td></tr>
</tbody></table>
<h3>Key Milestones</h3>
<ol><li><strong>Feb 1</strong> — Design review and approval</li><li><strong>Mar 15</strong> — Beta release to internal testers</li><li><strong>Apr 30</strong> — Full launch and rollout</li></ol>
<h3>Risks and Mitigations</h3>
<ul><li><strong>Risk:</strong> Third-party API rate limits during peak hours — <strong>Mitigation:</strong> Implement caching layer and request throttling</li></ul>`,
      },
      {
        title: 'Product Requirements Document',
        type: 'regular',
        content: `<h2>Product Requirements Document (PRD)</h2>
<p><strong>Feature:</strong> Multi-Currency Support | <strong>Version:</strong> 1.0 | <strong>Author:</strong> Tanya Reeves</p>
<hr/>
<h3>Problem Statement</h3>
<p>International customers (35% of our user base) are forced to convert prices manually, leading to cart abandonment rates 2x higher than domestic users. Supporting multiple currencies will reduce friction and increase conversion.</p>
<h3>Proposed Solution</h3>
<p>Add automatic currency detection based on user locale, with manual override. Display prices in the user's preferred currency using real-time exchange rates from the Open Exchange Rates API.</p>
<h3>User Stories</h3>
<table><thead><tr><th>As a...</th><th>I want to...</th><th>So that...</th><th>Priority</th></tr></thead><tbody>
<tr><td>International customer</td><td>see prices in my local currency</td><td>I can make purchase decisions without manual conversion</td><td>P0</td></tr>
<tr><td>Admin</td><td>set supported currencies</td><td>we control which markets we actively serve</td><td>P1</td></tr>
</tbody></table>
<h3>Success Metrics</h3>
<ul><li>Reduce international cart abandonment by 25%</li><li>Increase international revenue by 15% within 3 months</li></ul>
<h3>Technical Considerations</h3>
<p>Exchange rates should be cached for 1 hour to minimize API calls. All prices stored in USD internally; conversion happens at display time only.</p>`,
      },
      {
        title: 'Project Retrospective',
        type: 'regular',
        content: `<h2>Project Retrospective</h2>
<p><strong>Project:</strong> Mobile App v3.0 Launch | <strong>Date:</strong> Feb 5, 2025 | <strong>Duration:</strong> 12 weeks</p>
<hr/>
<h3>What Went Well</h3>
<ul><li>Shipped 2 days ahead of schedule due to parallel workstreams</li><li>Zero critical bugs reported in the first week post-launch</li><li>Cross-team collaboration between design and engineering was seamless</li></ul>
<h3>What Could Be Improved</h3>
<ul><li>QA was bottlenecked in week 8 due to insufficient test device coverage</li><li>Stakeholder feedback loop was too slow in the early design phase</li></ul>
<h3>Key Metrics</h3>
<table><thead><tr><th>Metric</th><th>Target</th><th>Actual</th><th>Status</th></tr></thead><tbody>
<tr><td>Delivery Date</td><td>Feb 7</td><td>Feb 5</td><td>On Time</td></tr>
<tr><td>Budget</td><td>$85,000</td><td>$91,200</td><td>Over by 7%</td></tr>
<tr><td>App Store Rating</td><td>4.5</td><td>4.7</td><td>Exceeded</td></tr>
</tbody></table>
<h3>Lessons Learned</h3>
<ol><li>Invest in a broader test device lab before the next mobile release</li><li>Schedule weekly stakeholder syncs from day one to keep feedback loops tight</li></ol>
<h3>Action Items for Next Project</h3>
<ul><li>Procure 5 additional test devices across iOS and Android</li><li>Create a stakeholder review calendar at project kickoff</li></ul>`,
      },
    ],
  },
  {
    id: 'recipe-collection',
    name: 'Recipe Collection',
    icon: 'Utensils',
    description: 'Beautifully structured recipe cards with ingredients tables and step-by-step instructions',
    category: 'Personal',
    folderColor: '#f59e0b',
    notes: [
      {
        title: 'Classic Garlic Butter Pasta',
        type: 'regular',
        content: `<h2>Classic Garlic Butter Pasta</h2>
<p><strong>Prep Time:</strong> 10 min | <strong>Cook Time:</strong> 15 min | <strong>Servings:</strong> 4</p>
<p><strong>Difficulty:</strong> Easy</p>
<hr/>
<h3>Ingredients</h3>
<table><thead><tr><th>Ingredient</th><th>Amount</th><th>Notes</th></tr></thead><tbody>
<tr><td>Spaghetti</td><td>400g</td><td>Or any pasta shape</td></tr>
<tr><td>Butter</td><td>4 tbsp</td><td>Unsalted</td></tr>
<tr><td>Garlic cloves</td><td>6</td><td>Minced</td></tr>
<tr><td>Olive oil</td><td>2 tbsp</td><td>Extra virgin</td></tr>
<tr><td>Parmesan</td><td>1 cup</td><td>Freshly grated</td></tr>
<tr><td>Red pepper flakes</td><td>1/2 tsp</td><td>Optional</td></tr>
<tr><td>Fresh parsley</td><td>1/4 cup</td><td>Chopped</td></tr>
</tbody></table>
<h3>Instructions</h3>
<ol>
<li>Bring a large pot of salted water to boil. Cook pasta according to package directions. Reserve 1 cup pasta water before draining.</li>
<li>In a large skillet, melt butter with olive oil over medium heat.</li>
<li>Add minced garlic and red pepper flakes. Cook for 1-2 minutes until fragrant (don't burn!).</li>
<li>Add drained pasta to the skillet. Toss to coat.</li>
<li>Add Parmesan and 1/2 cup pasta water. Toss until creamy, adding more water as needed.</li>
<li>Garnish with fresh parsley and extra Parmesan. Serve immediately.</li>
</ol>
<h3>Tips</h3>
<ul><li>Don't overcook the garlic — it goes bitter quickly</li><li>Pasta water is the secret to a silky sauce</li><li>Add grilled chicken or shrimp for protein</li></ul>`,
      },
      {
        title: 'Weekly Meal Prep Planner',
        type: 'regular',
        content: `<h2>Weekly Meal Prep Planner</h2>
<p><strong>Week of:</strong> February 10, 2025</p>
<hr/>
<h3>Meal Plan</h3>
<table><thead><tr><th>Day</th><th>Breakfast</th><th>Lunch</th><th>Dinner</th><th>Snacks</th></tr></thead><tbody>
<tr><td><strong>Mon</strong></td><td>Oatmeal with berries</td><td>Grilled chicken salad</td><td>Garlic butter pasta</td><td>Apple slices with almond butter</td></tr>
<tr><td><strong>Tue</strong></td><td>Green smoothie</td><td>Turkey avocado wrap</td><td>Teriyaki stir fry</td><td>Mixed nuts</td></tr>
<tr><td><strong>Wed</strong></td><td>Scrambled eggs with toast</td><td>Lentil soup</td><td>Grilled salmon with vegetables</td><td>Greek yogurt</td></tr>
<tr><td><strong>Thu</strong></td><td>Banana pancakes</td><td>Quinoa Buddha bowl</td><td>Chicken tacos</td><td>Carrot sticks with hummus</td></tr>
<tr><td><strong>Fri</strong></td><td>Avocado toast</td><td>Leftover tacos</td><td>Homemade pizza</td><td>Popcorn</td></tr>
</tbody></table>
<h3>Shopping List</h3>
<table><thead><tr><th>Category</th><th>Items</th><th>Got It</th></tr></thead><tbody>
<tr><td>Produce</td><td>Spinach, tomatoes, onions, garlic, avocados, berries, bananas</td><td></td></tr>
<tr><td>Protein</td><td>Chicken breast, eggs, salmon fillets, ground turkey, lentils</td><td></td></tr>
<tr><td>Dairy</td><td>Milk, Greek yogurt, mozzarella, Parmesan</td><td></td></tr>
<tr><td>Pantry</td><td>Rice, pasta, olive oil, soy sauce, quinoa, spices</td><td></td></tr>
</tbody></table>`,
      },
    ],
  },
  {
    id: 'travel-journal',
    name: 'Travel Journal',
    icon: 'Globe',
    description: 'Trip planner, packing checklist, and daily travel journal templates',
    category: 'Travel',
    folderColor: '#0ea5e9',
    notes: [
      {
        title: 'Trip Planner',
        type: 'regular',
        content: `<h2>Trip Planner</h2>
<p><strong>Destination:</strong> Kyoto, Japan</p>
<p><strong>Dates:</strong> April 5 - April 12, 2025 | <strong>Budget:</strong> $3,500</p>
<hr/>
<h3>Accommodation</h3>
<table><thead><tr><th>Dates</th><th>Hotel/Airbnb</th><th>Address</th><th>Confirmation #</th><th>Cost</th></tr></thead><tbody>
<tr><td>Apr 5-9</td><td>Sakura Ryokan</td><td>123 Gion District, Kyoto</td><td>BK-449821</td><td>$720</td></tr>
<tr><td>Apr 9-12</td><td>Hotel Granvia Kyoto</td><td>Karasuma-dori, Shiokoji</td><td>HG-331067</td><td>$540</td></tr>
</tbody></table>
<h3>Transportation</h3>
<table><thead><tr><th>Type</th><th>Details</th><th>Time</th><th>Booking Ref</th></tr></thead><tbody>
<tr><td>Flight</td><td>JAL 402 - SFO to KIX</td><td>Apr 5, 11:30 AM</td><td>JAL-88201</td></tr>
<tr><td>Train</td><td>JR Pass - 7 Day</td><td>Apr 5 onwards</td><td>JRP-55419</td></tr>
</tbody></table>
<h3>Itinerary</h3>
<table><thead><tr><th>Day</th><th>Morning</th><th>Afternoon</th><th>Evening</th></tr></thead><tbody>
<tr><td>Day 1</td><td>Arrival, check-in at ryokan</td><td>Fushimi Inari Shrine</td><td>Pontocho Alley dinner</td></tr>
<tr><td>Day 2</td><td>Arashiyama Bamboo Grove</td><td>Monkey Park and Togetsukyo Bridge</td><td>Kaiseki dinner</td></tr>
<tr><td>Day 3</td><td>Kinkaku-ji Golden Pavilion</td><td>Nishiki Market food tour</td><td>Gion geisha district walk</td></tr>
</tbody></table>
<h3>Important Contacts</h3>
<ul><li>Emergency: 110 (Police) / 119 (Ambulance)</li><li>Hotel: +81-75-344-8888</li><li>US Embassy Tokyo: +81-3-3224-5000</li></ul>`,
      },
      {
        title: 'Packing Checklist',
        type: 'regular',
        content: `<h2>Packing Checklist</h2>
<p><strong>Trip:</strong> Kyoto, Japan | <strong>Duration:</strong> 7 days | <strong>Weather:</strong> Mild spring, 12-20C with occasional rain</p>
<hr/>
<h3>Clothing</h3>
<table><thead><tr><th>Item</th><th>Qty</th><th>Packed</th></tr></thead><tbody>
<tr><td>T-shirts</td><td>5</td><td></td></tr>
<tr><td>Pants/shorts</td><td>3</td><td></td></tr>
<tr><td>Underwear</td><td>7</td><td></td></tr>
<tr><td>Socks</td><td>5</td><td></td></tr>
<tr><td>Light rain jacket</td><td>1</td><td></td></tr>
<tr><td>Sleepwear</td><td>2</td><td></td></tr>
</tbody></table>
<h3>Toiletries</h3>
<table><thead><tr><th>Item</th><th>Packed</th></tr></thead><tbody>
<tr><td>Toothbrush and toothpaste</td><td></td></tr>
<tr><td>Shampoo and conditioner</td><td></td></tr>
<tr><td>Sunscreen SPF 50</td><td></td></tr>
<tr><td>Deodorant</td><td></td></tr>
<tr><td>Allergy medication</td><td></td></tr>
</tbody></table>
<h3>Electronics</h3>
<table><thead><tr><th>Item</th><th>Packed</th></tr></thead><tbody>
<tr><td>Phone and charger</td><td></td></tr>
<tr><td>Power bank</td><td></td></tr>
<tr><td>Camera with extra SD card</td><td></td></tr>
<tr><td>Japan-compatible travel adapter</td><td></td></tr>
</tbody></table>
<h3>Documents</h3>
<table><thead><tr><th>Item</th><th>Packed</th></tr></thead><tbody>
<tr><td>Passport (valid through Oct 2027)</td><td></td></tr>
<tr><td>Boarding passes (printed)</td><td></td></tr>
<tr><td>Travel insurance card</td><td></td></tr>
<tr><td>Hotel confirmation printouts</td><td></td></tr>
</tbody></table>`,
      },
      {
        title: 'Daily Travel Journal',
        type: 'regular',
        content: `<h2>Travel Journal — Day 1</h2>
<p><strong>Date:</strong> April 5, 2025 | <strong>Location:</strong> Kyoto, Japan</p>
<p><strong>Weather:</strong> Clear skies, 18C | <strong>Mood:</strong> Excited</p>
<hr/>
<h3>Morning</h3>
<p>Landed at Kansai International Airport after a smooth 11-hour flight. Picked up the JR Pass and took the Haruka Express to Kyoto Station. The countryside views were beautiful — endless rice paddies and distant mountains.</p>
<h3>Afternoon</h3>
<p>Checked into the ryokan in Gion. The tatami room is stunning. Walked to Fushimi Inari Shrine and hiked halfway up the mountain through thousands of vermillion torii gates. The higher you go, the fewer tourists.</p>
<h3>Evening</h3>
<p>Dinner at a small izakaya on Pontocho Alley. Had yakitori, edamame, and the best miso soup I've ever tasted. Walked along the Kamo River at sunset — the reflections on the water were magical.</p>
<h3>Food Highlights</h3>
<table><thead><tr><th>Meal</th><th>Restaurant</th><th>Dish</th><th>Rating</th></tr></thead><tbody>
<tr><td>Breakfast</td><td>Airport lounge</td><td>Onigiri and green tea</td><td>Good</td></tr>
<tr><td>Lunch</td><td>Station bento</td><td>Salmon bento box</td><td>Very Good</td></tr>
<tr><td>Dinner</td><td>Yakitori Ippon</td><td>Assorted yakitori platter</td><td>Excellent</td></tr>
</tbody></table>
<h3>Reflections</h3>
<p>The pace of life here feels intentionally slower. Everything from the train announcements to the way food is presented feels considered and deliberate. Already dreading having to leave.</p>`,
      },
    ],
  },
  {
    id: 'health-wellness',
    name: 'Health and Wellness',
    icon: 'Heart',
    description: 'Workout log, wellness tracker, and daily check-in for a balanced life',
    category: 'Health',
    folderColor: '#ef4444',
    notes: [
      {
        title: 'Workout Log',
        type: 'regular',
        content: `<h2>Workout Log</h2>
<p><strong>Date:</strong> February 8, 2025 | <strong>Duration:</strong> 55 minutes | <strong>Type:</strong> Upper Body Strength</p>
<hr/>
<h3>Exercises</h3>
<table><thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Weight</th><th>Notes</th></tr></thead><tbody>
<tr><td>Bench Press</td><td>4</td><td>10</td><td>60kg</td><td>Good form, controlled tempo</td></tr>
<tr><td>Barbell Squats</td><td>4</td><td>12</td><td>80kg</td><td>Increase to 85kg next session</td></tr>
<tr><td>Deadlift</td><td>3</td><td>8</td><td>100kg</td><td>New personal record</td></tr>
<tr><td>Pull-ups</td><td>3</td><td>10</td><td>Bodyweight</td><td>Strict form, no kipping</td></tr>
<tr><td>Plank</td><td>3</td><td>60s</td><td>-</td><td>Held steady without dropping</td></tr>
</tbody></table>
<h3>Session Summary</h3>
<ul><li><strong>Energy Level:</strong> 4/5</li><li><strong>Difficulty:</strong> 3/5</li><li><strong>Satisfaction:</strong> 5/5</li></ul>
<h3>Notes</h3>
<p>Felt strong today after a full night of sleep. The deadlift PR was a nice surprise. Need to focus on shoulder mobility before next push day.</p>`,
      },
      {
        title: 'Daily Wellness Tracker',
        type: 'regular',
        content: `<h2>Daily Wellness Tracker</h2>
<p><strong>Date:</strong> February 8, 2025</p>
<hr/>
<h3>Mood Check</h3>
<p>Morning: Energized | Afternoon: Focused | Evening: Relaxed</p>
<h3>Daily Metrics</h3>
<table><thead><tr><th>Metric</th><th>Goal</th><th>Actual</th><th>Status</th></tr></thead><tbody>
<tr><td>Water</td><td>8 glasses</td><td>7 glasses</td><td>Almost</td></tr>
<tr><td>Sleep</td><td>8 hours</td><td>7.5 hours</td><td>Close</td></tr>
<tr><td>Steps</td><td>10,000</td><td>11,240</td><td>Done</td></tr>
<tr><td>Meditation</td><td>10 min</td><td>15 min</td><td>Done</td></tr>
<tr><td>Reading</td><td>30 min</td><td>20 min</td><td>Partial</td></tr>
</tbody></table>
<h3>Gratitude</h3>
<ol><li>A productive morning with no interruptions</li><li>A good conversation with an old friend over lunch</li><li>The warm sunshine during my afternoon walk</li></ol>
<h3>Journal</h3>
<p>Today was steady and productive. Managed to finish the presentation ahead of schedule. Skipped the last glass of water — need to keep a bottle at my desk as a reminder. Overall a solid day.</p>`,
      },
    ],
  },
  {
    id: 'creative-writing',
    name: 'Creative Writing',
    icon: 'Lightbulb',
    description: 'Story outline, character sheet, and brainstorm templates for writers',
    category: 'Creative',
    folderColor: '#ec4899',
    notes: [
      {
        title: 'Story Outline',
        type: 'regular',
        content: `<h2>Story Outline</h2>
<p><strong>Title:</strong> The Last Cartographer | <strong>Genre:</strong> Science Fiction | <strong>Word Count Goal:</strong> 80,000</p>
<hr/>
<h3>Premise</h3>
<p>A reclusive mapmaker discovers that the uncharted territories on her grandfather's ancient maps correspond to real places that are vanishing from reality, and she must complete his final map before the world unravels.</p>
<h3>Three-Act Structure</h3>
<table><thead><tr><th>Act</th><th>Section</th><th>Events</th></tr></thead><tbody>
<tr><td rowspan="3"><strong>Act 1</strong><br/>Setup</td><td>Opening</td><td>Elena inherits her grandfather's map shop in a coastal town. She finds an unfinished map hidden in the floorboards.</td></tr>
<tr><td>Inciting Incident</td><td>A town from the map disappears from all records overnight. Elena is the only one who remembers it.</td></tr>
<tr><td>First Plot Point</td><td>She meets Kai, a historian who has been tracking similar disappearances. They decide to follow the map's trail.</td></tr>
<tr><td rowspan="3"><strong>Act 2</strong><br/>Confrontation</td><td>Rising Action</td><td>Each location they visit reveals a piece of the puzzle. The map is a key to stabilizing a fracturing dimension.</td></tr>
<tr><td>Midpoint</td><td>Elena discovers she has the same gift as her grandfather — she can see the fractures in reality.</td></tr>
<tr><td>Crisis</td><td>Kai is erased from existence. Elena must continue alone with the map half-complete.</td></tr>
<tr><td rowspan="2"><strong>Act 3</strong><br/>Resolution</td><td>Climax</td><td>Elena reaches the final location and must choose: complete the map and restore everything, or keep the new reality where she finally belongs.</td></tr>
<tr><td>Resolution</td><td>She completes the map. The world resets. Kai returns, but Elena's memory of the journey fades like a dream.</td></tr>
</tbody></table>
<h3>Themes</h3>
<ul><li>Memory and identity — what makes us who we are</li><li>The cost of legacy — carrying the burdens of those who came before</li></ul>`,
      },
      {
        title: 'Character Profile Sheet',
        type: 'regular',
        content: `<h2>Character Profile</h2>
<hr/>
<h3>Basic Info</h3>
<table><thead><tr><th>Attribute</th><th>Details</th></tr></thead><tbody>
<tr><td><strong>Full Name</strong></td><td>Elena Vasquez-Moore</td></tr>
<tr><td><strong>Age</strong></td><td>34</td></tr>
<tr><td><strong>Occupation</strong></td><td>Freelance cartographer and antique map restorer</td></tr>
<tr><td><strong>Appearance</strong></td><td>Dark curly hair, olive skin, always wears her grandfather's compass pendant</td></tr>
<tr><td><strong>Personality</strong></td><td>Meticulous, quietly stubborn, deeply curious but socially guarded</td></tr>
</tbody></table>
<h3>Psychology</h3>
<table><thead><tr><th>Aspect</th><th>Details</th></tr></thead><tbody>
<tr><td><strong>Greatest Fear</strong></td><td>Being forgotten — that her work and existence will leave no mark</td></tr>
<tr><td><strong>Deepest Desire</strong></td><td>To understand why her grandfather devoted his life to maps no one else could read</td></tr>
<tr><td><strong>Fatal Flaw</strong></td><td>She refuses to ask for help, believing she must carry every burden alone</td></tr>
<tr><td><strong>Strength</strong></td><td>Extraordinary spatial memory — she can recall any place she's visited in perfect detail</td></tr>
<tr><td><strong>Secret</strong></td><td>She has been seeing the "fractures" since childhood but told no one, fearing she was losing her mind</td></tr>
</tbody></table>
<h3>Backstory</h3>
<p>Raised by her grandfather after her parents died in a research expedition. He taught her cartography as a way to understand the world, but she always sensed he was mapping something beyond geography. When he died, he left only one instruction: "Finish the map."</p>
<h3>Character Arc</h3>
<p><strong>Starts as:</strong> A solitary perfectionist who trusts maps more than people</p>
<p><strong>Ends as:</strong> Someone who understands that the most important maps are the connections between people, not places</p>`,
      },
      {
        title: 'Brainstorm and Ideas',
        type: 'regular',
        content: `<h2>Brainstorm Session</h2>
<p><strong>Topic:</strong> Mobile app for local artisan marketplace | <strong>Date:</strong> Feb 8, 2025</p>
<hr/>
<h3>Brain Dump</h3>
<p>What if local artisans could list products with AR previews? Buyers see how a handmade vase looks on their shelf before ordering. Include a "maker story" video for each seller. Subscription box model for curated monthly artisan goods. Partner with local coffee shops as pickup points. Seasonal collections tied to local festivals.</p>
<h3>Top Ideas</h3>
<table><thead><tr><th>#</th><th>Idea</th><th>Potential</th><th>Effort</th></tr></thead><tbody>
<tr><td>1</td><td>AR product previews in your space</td><td>Very High</td><td>High</td></tr>
<tr><td>2</td><td>Monthly curated artisan subscription box</td><td>High</td><td>Medium</td></tr>
<tr><td>3</td><td>Maker story video profiles</td><td>High</td><td>Low</td></tr>
</tbody></table>
<h3>Connections and Patterns</h3>
<p>The AR preview and maker stories both serve the same goal: building trust and emotional connection between buyer and artisan. The subscription box could feature the month's top-rated makers, creating a virtuous cycle.</p>
<h3>Next Steps</h3>
<ol><li>Research AR SDK options for React Native (ARKit, ARCore)</li><li>Survey 20 local artisans on interest and pricing expectations</li><li>Mock up the subscription box landing page for user testing</li></ol>`,
      },
    ],
  },
  {
    id: 'finance-toolkit',
    name: 'Finance Toolkit',
    icon: 'Receipt',
    description: 'Budget tracker, invoice template, and expense report for personal and business finance',
    category: 'Finance',
    folderColor: '#10b981',
    notes: [
      {
        title: 'Monthly Budget Tracker',
        type: 'regular',
        content: `<h2>Monthly Budget Tracker</h2>
<p><strong>Month:</strong> February 2025 | <strong>Total Budget:</strong> $5,200</p>
<hr/>
<h3>Income</h3>
<table><thead><tr><th>Source</th><th>Expected</th><th>Actual</th><th>Difference</th></tr></thead><tbody>
<tr><td>Salary</td><td>$4,200</td><td>$4,200</td><td>$0</td></tr>
<tr><td>Freelance</td><td>$800</td><td>$650</td><td>-$150</td></tr>
<tr><td>Interest</td><td>$45</td><td>$48</td><td>+$3</td></tr>
<tr><td><strong>Total</strong></td><td><strong>$5,045</strong></td><td><strong>$4,898</strong></td><td><strong>-$147</strong></td></tr>
</tbody></table>
<h3>Expenses</h3>
<table><thead><tr><th>Category</th><th>Budgeted</th><th>Spent</th><th>Remaining</th></tr></thead><tbody>
<tr><td>Rent</td><td>$1,400</td><td>$1,400</td><td>$0</td></tr>
<tr><td>Groceries</td><td>$450</td><td>$382</td><td>$68</td></tr>
<tr><td>Transportation</td><td>$200</td><td>$175</td><td>$25</td></tr>
<tr><td>Utilities</td><td>$180</td><td>$192</td><td>-$12</td></tr>
<tr><td>Subscriptions</td><td>$65</td><td>$65</td><td>$0</td></tr>
<tr><td>Dining Out</td><td>$200</td><td>$245</td><td>-$45</td></tr>
<tr><td>Entertainment</td><td>$100</td><td>$80</td><td>$20</td></tr>
<tr><td>Health</td><td>$120</td><td>$120</td><td>$0</td></tr>
<tr><td>Miscellaneous</td><td>$150</td><td>$95</td><td>$55</td></tr>
<tr><td><strong>Total</strong></td><td><strong>$2,865</strong></td><td><strong>$2,754</strong></td><td><strong>$111</strong></td></tr>
</tbody></table>
<h3>Savings Goals</h3>
<table><thead><tr><th>Goal</th><th>Target</th><th>Saved This Month</th><th>Total Progress</th></tr></thead><tbody>
<tr><td>Emergency Fund</td><td>$10,000</td><td>$500</td><td>$7,200 / $10,000</td></tr>
<tr><td>Vacation</td><td>$3,000</td><td>$300</td><td>$1,800 / $3,000</td></tr>
</tbody></table>
<h3>Notes</h3>
<p>Dining out exceeded budget again — consider meal prepping on Sundays. Freelance income was lower due to one project delay; payment expected in March. Overall on track with savings targets.</p>`,
      },
      {
        title: 'Invoice Template',
        type: 'regular',
        content: `<h2>Invoice</h2>
<p><strong>Invoice #:</strong> INV-2025-0042 | <strong>Date:</strong> February 8, 2025 | <strong>Due Date:</strong> March 8, 2025</p>
<hr/>
<h3>From</h3>
<p><strong>Thompson Design Studio</strong><br/>742 Evergreen Terrace, Suite 200<br/>Portland, OR 97201<br/>Email: billing@thompsondesign.co | Phone: (503) 555-0147</p>
<h3>Bill To</h3>
<p><strong>Meridian Solutions Inc.</strong><br/>1200 NW Marshall St<br/>Portland, OR 97209<br/>Email: accounts@meridiansolutions.com</p>
<hr/>
<h3>Services / Items</h3>
<table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>
<tr><td>Brand identity design package</td><td>1</td><td>$2,500</td><td>$2,500</td></tr>
<tr><td>Website UI/UX design (5 pages)</td><td>5</td><td>$400</td><td>$2,000</td></tr>
<tr><td>Social media asset kit</td><td>1</td><td>$750</td><td>$750</td></tr>
</tbody></table>
<table><tbody>
<tr><td style="text-align:right"><strong>Subtotal</strong></td><td style="width:120px">$5,250</td></tr>
<tr><td style="text-align:right"><strong>Tax (8%)</strong></td><td>$420</td></tr>
<tr><td style="text-align:right"><strong>Discount (Returning Client)</strong></td><td>-$250</td></tr>
<tr><td style="text-align:right"><strong>Total Due</strong></td><td><strong>$5,420</strong></td></tr>
</tbody></table>
<h3>Payment Methods</h3>
<ul><li>Bank Transfer: Chase Bank, Acct 4821-7739, Routing 325070760</li><li>PayPal: payments@thompsondesign.co</li><li>Venmo: @thompson-design</li></ul>
<h3>Terms and Notes</h3>
<p>Payment due within 30 days. Late payments may incur a 1.5% monthly fee.<br/>Thank you for your business — it's a pleasure working with the Meridian team!</p>`,
      },
      {
        title: 'Expense Report',
        type: 'regular',
        content: `<h2>Expense Report</h2>
<p><strong>Employee:</strong> Jordan Lee | <strong>Department:</strong> Marketing | <strong>Period:</strong> Jan 27 - Feb 7, 2025</p>
<hr/>
<h3>Expenses</h3>
<table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Payment Method</th><th>Amount</th><th>Receipt</th></tr></thead><tbody>
<tr><td>Jan 28</td><td>Travel</td><td>Round-trip train to NYC for client meeting</td><td>Corporate Card</td><td>$186</td><td>Yes</td></tr>
<tr><td>Jan 28</td><td>Meals</td><td>Client lunch at Gramercy Tavern</td><td>Corporate Card</td><td>$124</td><td>Yes</td></tr>
<tr><td>Feb 1</td><td>Supplies</td><td>Presentation easel and markers</td><td>Personal Card</td><td>$47</td><td>Yes</td></tr>
<tr><td>Feb 3</td><td>Software</td><td>Figma annual team license renewal</td><td>Corporate Card</td><td>$540</td><td>Yes</td></tr>
<tr><td>Feb 5</td><td>Meals</td><td>Team lunch for project kickoff</td><td>Personal Card</td><td>$89</td><td>No</td></tr>
</tbody></table>
<h3>Summary by Category</h3>
<table><thead><tr><th>Category</th><th>Total</th></tr></thead><tbody>
<tr><td>Travel</td><td>$186</td></tr>
<tr><td>Meals</td><td>$213</td></tr>
<tr><td>Supplies</td><td>$47</td></tr>
<tr><td>Software</td><td>$540</td></tr>
<tr><td><strong>Grand Total</strong></td><td><strong>$986</strong></td></tr>
</tbody></table>
<h3>Approval</h3>
<p>Submitted by: Jordan Lee — Date: Feb 7, 2025<br/>Approved by: _________________ — Date: _________</p>`,
      },
    ],
  },
  {
    id: 'daily-journaling',
    name: 'Daily Journaling',
    icon: 'Notebook',
    description: 'Morning pages, gratitude journal, and weekly reflection templates for mindful living',
    category: 'Journaling',
    folderColor: '#f59e0b',
    notes: [
      {
        title: 'Morning Pages',
        type: 'regular',
        content: `<h2>Morning Pages</h2>
<p><strong>Date:</strong> February 8, 2025 | <strong>Woke up at:</strong> 6:45 AM | <strong>Sleep quality:</strong> Very good</p>
<hr/>
<h3>Morning Check-In</h3>
<table><thead><tr><th>Question</th><th>Answer</th></tr></thead><tbody>
<tr><td>How do I feel right now?</td><td>Physically rested, mentally clear, slightly anxious about the presentation today</td></tr>
<tr><td>What did I dream about?</td><td>Vivid dream about traveling through a forest with an old school friend</td></tr>
<tr><td>What am I looking forward to?</td><td>Coffee with Maya after work</td></tr>
<tr><td>What might be challenging?</td><td>Staying focused during the afternoon budget review meeting</td></tr>
</tbody></table>
<h3>Today's Intentions</h3>
<ol><li><strong>Top Priority:</strong> Finalize and rehearse the Q1 results presentation</li><li>Reply to the three pending client emails from yesterday</li><li>Go for a 20-minute walk during lunch break</li></ol>
<h3>Free Writing</h3>
<p>The morning light is coming through the window and it feels like the kind of day where things click into place. I've been putting off that presentation but honestly the data tells a good story. I just need to trust it and stop over-editing. Maybe that's a theme for me lately — trusting that things are good enough without endless polishing...</p>
<h3>Ideas That Came Up</h3>
<ul><li>Start a weekend photography project — just capturing small details around the neighborhood</li></ul>
<h3>Affirmation</h3>
<blockquote><p>"I am prepared, I am capable, and I trust myself to handle whatever today brings."</p></blockquote>`,
      },
      {
        title: 'Gratitude Journal',
        type: 'regular',
        content: `<h2>Gratitude Journal</h2>
<p><strong>Date:</strong> February 8, 2025 | <strong>Overall Mood:</strong> Good</p>
<hr/>
<h3>Three Things I'm Grateful For</h3>
<table><thead><tr><th>#</th><th>I'm Grateful For...</th><th>Why It Matters</th></tr></thead><tbody>
<tr><td>1</td><td>A quiet morning with no meetings before 10 AM</td><td>It gave me space to think clearly and plan my day without rushing</td></tr>
<tr><td>2</td><td>My colleague Raj who helped debug an issue I'd been stuck on</td><td>Reminded me that asking for help isn't weakness — it's collaboration</td></tr>
<tr><td>3</td><td>The homemade soup I had for dinner</td><td>Simple, warm, and made me appreciate the comfort of home-cooked food</td></tr>
</tbody></table>
<h3>Today's Wins</h3>
<ul><li><strong>Big win:</strong> Delivered the quarterly presentation and received positive feedback from the VP</li><li><strong>Small win:</strong> Remembered to drink water throughout the day — hit 7 glasses</li></ul>
<h3>Acts of Kindness</h3>
<p><strong>Kindness I received:</strong> A stranger held the elevator door when I was running late</p>
<p><strong>Kindness I gave:</strong> Left an encouraging comment on a junior developer's first pull request</p>
<h3>Moment I Want to Remember</h3>
<p>Sitting in the park during lunch, watching two dogs play while their owners chatted. The sun was warm on my face and for a few minutes, nothing felt urgent.</p>
<h3>Evening Reflection</h3>
<p>If I could relive one moment from today, it would be: That quiet park bench at noon</p>
<p>Tomorrow, I'm looking forward to: Saturday morning — sleeping in and making pancakes</p>`,
      },
      {
        title: 'Weekly Reflection',
        type: 'regular',
        content: `<h2>Weekly Reflection</h2>
<p><strong>Week of:</strong> February 3 — February 9, 2025</p>
<hr/>
<h3>This Week's Highlights</h3>
<table><thead><tr><th>Day</th><th>Highlight</th><th>How I Felt</th></tr></thead><tbody>
<tr><td>Monday</td><td>Kicked off the new project with the team</td><td>Motivated</td></tr>
<tr><td>Tuesday</td><td>Had a great gym session — new deadlift PR</td><td>Proud</td></tr>
<tr><td>Wednesday</td><td>Resolved a tricky production bug before lunch</td><td>Relieved</td></tr>
<tr><td>Thursday</td><td>Dinner with college friends I hadn't seen in months</td><td>Happy</td></tr>
<tr><td>Friday</td><td>Delivered the Q1 presentation successfully</td><td>Accomplished</td></tr>
<tr><td>Saturday</td><td>Explored a new hiking trail at Blue Ridge</td><td>Peaceful</td></tr>
<tr><td>Sunday</td><td>Meal prepped for the week and read two chapters</td><td>Content</td></tr>
</tbody></table>
<h3>Goals Review</h3>
<table><thead><tr><th>Goal</th><th>Progress</th><th>Status</th></tr></thead><tbody>
<tr><td>Complete Q1 presentation</td><td>Finished and delivered on Friday</td><td>Done</td></tr>
<tr><td>Exercise 4 times</td><td>Gym Mon, Wed, Fri + hike Saturday</td><td>Done</td></tr>
<tr><td>Read 50 pages</td><td>Read 38 pages</td><td>In Progress</td></tr>
</tbody></table>
<h3>Lessons Learned</h3>
<ol><li>Preparing presentations early removes 90% of the stress</li><li>Scheduling social time mid-week breaks up the monotony</li><li>I'm more productive when I start the day without checking email</li></ol>
<h3>Next Week's Focus</h3>
<ul><li><strong>Priority 1:</strong> Draft the product spec for the new dashboard feature</li><li><strong>Priority 2:</strong> Finish the remaining 12 pages of the book</li><li><strong>Habit to build:</strong> No phone for the first 30 minutes after waking</li></ul>
<h3>One Word to Describe This Week</h3>
<p style="font-size:1.5em;text-align:center"><strong>Momentum</strong></p>`,
      },
    ],
  },
  {
    id: 'interview-prep',
    name: 'Interview Prep',
    icon: 'Briefcase',
    description: 'STAR method responses, company research notes, and question bank for job interviews',
    category: 'Career',
    folderColor: '#6366f1',
    notes: [
      {
        title: 'STAR Method Responses',
        type: 'regular',
        content: `<h2>STAR Method Response Bank</h2>
<p>Prepare 4-5 stories that cover leadership, problem-solving, conflict, and failure. Each story can answer multiple question types.</p>
<hr/>
<h3>Story 1: Leadership Under Pressure</h3>
<table><thead><tr><th>Component</th><th>Your Response</th></tr></thead><tbody>
<tr><td><strong>Situation</strong></td><td>Our lead engineer left two weeks before a major product launch at Nexus Tech. The team of six was demoralized and behind schedule.</td></tr>
<tr><td><strong>Task</strong></td><td>As the senior developer, I stepped up to coordinate the remaining work and keep the team aligned on the launch deadline.</td></tr>
<tr><td><strong>Action</strong></td><td>I reorganized the sprint into daily micro-goals, redistributed tasks based on individual strengths, and held brief 15-minute standups each morning. I also personally took on the most complex integration work.</td></tr>
<tr><td><strong>Result</strong></td><td>We launched on time with zero critical bugs. Post-launch user engagement was 40% above projections, and two team members later said it was their best project experience.</td></tr>
</tbody></table>
<p><strong>Best for questions like:</strong> "Tell me about a time you led a team..." / "Describe a high-pressure situation..."</p>
<hr/>
<h3>Story 2: Creative Problem Solving</h3>
<table><thead><tr><th>Component</th><th>Your Response</th></tr></thead><tbody>
<tr><td><strong>Situation</strong></td><td>Our API response times had degraded to 3+ seconds, causing a 15% increase in user drop-off on the checkout page.</td></tr>
<tr><td><strong>Task</strong></td><td>I was asked to diagnose and fix the performance issue within one sprint cycle (2 weeks).</td></tr>
<tr><td><strong>Action</strong></td><td>Profiled the database queries and discovered N+1 query patterns in three endpoints. Implemented query batching, added Redis caching for frequently accessed data, and set up performance monitoring dashboards.</td></tr>
<tr><td><strong>Result</strong></td><td>Response times dropped from 3.2s to 180ms. Checkout completion rates improved by 22% in the following month.</td></tr>
</tbody></table>
<p><strong>Best for questions like:</strong> "Describe a difficult problem you solved..." / "When did you think outside the box?"</p>
<hr/>
<h3>Story 3: Conflict Resolution</h3>
<table><thead><tr><th>Component</th><th>Your Response</th></tr></thead><tbody>
<tr><td><strong>Situation</strong></td><td>The design team and engineering team had a fundamental disagreement about the navigation redesign. Tensions were rising and blocking progress for two weeks.</td></tr>
<tr><td><strong>Task</strong></td><td>As the product owner, I needed to find a resolution that satisfied both teams and unblocked the project.</td></tr>
<tr><td><strong>Action</strong></td><td>Organized a collaborative workshop where both sides presented their rationale with data. Facilitated a compromise using A/B testing — we'd ship both approaches to 50% of users and let metrics decide.</td></tr>
<tr><td><strong>Result</strong></td><td>The A/B test revealed a hybrid approach worked best. Both teams felt heard, and the final design outperformed both original proposals by 18% in engagement.</td></tr>
</tbody></table>
<p><strong>Best for questions like:</strong> "Tell me about a disagreement with a colleague..." / "How do you handle conflict?"</p>
<hr/>
<h3>Story 4: Failure and Learning</h3>
<table><thead><tr><th>Component</th><th>Your Response</th></tr></thead><tbody>
<tr><td><strong>Situation</strong></td><td>I championed a new feature that I was confident users wanted, but skipped proper user research to meet an aggressive timeline.</td></tr>
<tr><td><strong>Task</strong></td><td>I was responsible for the feature strategy, design approval, and launch metrics.</td></tr>
<tr><td><strong>Action</strong></td><td>After launch, adoption was only 3% after two weeks. I initiated a post-mortem, conducted user interviews, and discovered the feature solved a problem users had already worked around. I recommended sunsetting it and reallocating resources.</td></tr>
<tr><td><strong>Result</strong></td><td>We saved $40K in ongoing maintenance. I established a mandatory user research phase for all new features, which became team policy and prevented similar missteps on three subsequent projects.</td></tr>
</tbody></table>
<p><strong>Best for questions like:</strong> "Tell me about a time you failed..." / "What's your biggest mistake?"</p>`,
      },
      {
        title: 'Company Research Notes',
        type: 'regular',
        content: `<h2>Company Research</h2>
<p><strong>Company:</strong> Stripe | <strong>Position:</strong> Senior Product Manager | <strong>Interview Date:</strong> February 20, 2025</p>
<hr/>
<h3>Company Overview</h3>
<table><thead><tr><th>Detail</th><th>Info</th></tr></thead><tbody>
<tr><td>Founded</td><td>2010</td></tr>
<tr><td>Headquarters</td><td>San Francisco, CA / Dublin, Ireland</td></tr>
<tr><td>Industry</td><td>Financial Technology / Payments Infrastructure</td></tr>
<tr><td>Size</td><td>~8,000 employees</td></tr>
<tr><td>Valuation</td><td>$65B (as of 2024)</td></tr>
<tr><td>Founders</td><td>Patrick and John Collison</td></tr>
<tr><td>Mission</td><td>Increase the GDP of the internet</td></tr>
</tbody></table>
<h3>What They Do</h3>
<p>Stripe builds payment processing infrastructure for internet businesses. Their suite includes Stripe Payments, Billing, Connect (marketplace payments), Atlas (company incorporation), and Radar (fraud prevention). They serve millions of businesses from startups to Fortune 500 companies.</p>
<h3>Recent News</h3>
<ul><li>Launched Stripe Tax for automated global tax compliance (Q4 2024)</li><li>Expanded into embedded finance with Banking-as-a-Service products</li><li>Partnered with OpenAI to power their subscription billing</li></ul>
<h3>Why I Want to Work Here</h3>
<ol><li>Their developer-first philosophy aligns with how I think about product design — start with the best API, then build UI on top</li><li>Massive scale challenges — processing hundreds of billions in volume annually</li><li>Personal connection: I used Stripe for my first side project in 2018 and it shaped how I think about clean product experiences</li></ol>
<h3>Interviewers</h3>
<table><thead><tr><th>Name</th><th>Title</th><th>LinkedIn Notes</th></tr></thead><tbody>
<tr><td>Sarah Aldridge</td><td>Director of Product</td><td>Previously at Google Cloud, focuses on platform products</td></tr>
<tr><td>Marcus Chen</td><td>Staff Engineer</td><td>Core payments team, published talks on distributed systems</td></tr>
</tbody></table>
<h3>My Questions for Them</h3>
<ol><li>How does the PM team balance innovation on new products vs. reliability of core payments?</li><li>What does cross-functional collaboration look like day-to-day on your team?</li><li>How is Stripe thinking about the competitive landscape with Adyen and emerging players?</li><li>What's the most impactful project your team shipped in the last year?</li></ol>`,
      },
      {
        title: 'Interview Question Bank',
        type: 'regular',
        content: `<h2>Interview Question Bank</h2>
<p><strong>Role:</strong> Senior Product Manager | <strong>Company:</strong> Stripe</p>
<hr/>
<h3>Common Behavioral Questions</h3>
<table><thead><tr><th>Question</th><th>My Key Points</th><th>STAR Story #</th></tr></thead><tbody>
<tr><td>Tell me about yourself</td><td>5 years in product at fintech companies, led 3 major launches, passion for developer tools</td><td>-</td></tr>
<tr><td>Why do you want this role?</td><td>Stripe's mission aligns with my belief that great infrastructure unlocks innovation</td><td>-</td></tr>
<tr><td>What's your greatest strength?</td><td>Translating ambiguous user problems into clear, shippable product specs</td><td>Story #2</td></tr>
<tr><td>What's your biggest weakness?</td><td>Tendency to over-scope v1 features; I've learned to ruthlessly cut scope and iterate</td><td>-</td></tr>
<tr><td>Where do you see yourself in 5 years?</td><td>Leading a product area that shapes how businesses interact with financial infrastructure</td><td>-</td></tr>
<tr><td>Why are you leaving your current role?</td><td>Looking for larger scale impact and a world-class engineering culture to collaborate with</td><td>-</td></tr>
</tbody></table>
<h3>Situational Questions</h3>
<table><thead><tr><th>Question</th><th>My Approach</th></tr></thead><tbody>
<tr><td>How do you handle tight deadlines?</td><td>Triage ruthlessly: what's essential for launch vs. fast-follow. Communicate tradeoffs early.</td></tr>
<tr><td>Describe a time you disagreed with your manager</td><td>Used data to present my case, listened to their perspective, proposed a compromise (Story #3)</td></tr>
<tr><td>How do you handle multiple priorities?</td><td>Impact vs. effort matrix, weekly priority reviews, saying no to medium-impact work</td></tr>
<tr><td>Tell me about a time you failed</td><td>Skipped user research, feature flopped, built a research-first policy afterward (Story #4)</td></tr>
</tbody></table>
<h3>Role-Specific Questions</h3>
<table><thead><tr><th>Question</th><th>My Answer Notes</th></tr></thead><tbody>
<tr><td>How would you prioritize features for Stripe Billing?</td><td>Segment by customer size, analyze churn drivers, focus on reducing involuntary churn first</td></tr>
<tr><td>Design a payment flow for a marketplace</td><td>Consider split payments, escrow, refund flows, seller onboarding KYC</td></tr>
<tr><td>How do you measure success for a payments product?</td><td>Authorization rates, processing time, failed payment recovery rate, developer NPS</td></tr>
</tbody></table>
<h3>Salary and Logistics</h3>
<table><thead><tr><th>Topic</th><th>My Position</th></tr></thead><tbody>
<tr><td>Salary expectation</td><td>$185K-$210K base, based on Levels.fyi data for L6 PM at Stripe</td></tr>
<tr><td>Start date</td><td>March 15, 2025 (2 weeks notice)</td></tr>
<tr><td>Remote/hybrid preference</td><td>Hybrid — prefer 2-3 days in office</td></tr>
<tr><td>Notice period</td><td>2 weeks at current employer</td></tr>
</tbody></table>
<h3>Pre-Interview Checklist</h3>
<ul><li>Researched Stripe's products, mission, and recent launches</li><li>Practiced STAR stories out loud (recorded and reviewed)</li><li>Prepared 4 thoughtful questions for interviewers</li><li>Tested webcam, microphone, and internet for video call</li><li>Professional outfit selected and ready</li><li>Resume printed and accessible on tablet</li><li>Know interviewer names, titles, and backgrounds</li></ul>`,
      },
    ],
  },
  {
    id: 'personal-life',
    name: 'Personal Life Collection',
    icon: 'Heart',
    description: 'Daily reflections, personal goals, gratitude journaling, and self-care tracking',
    category: 'Personal Life',
    folderColor: '#ec4899',
    notes: [
      {
        title: 'Daily Reflection',
        type: 'lined',
        content: `<h2>Daily Reflection</h2>
<p><strong>Date:</strong> February 8, 2025</p>
<hr/>
<h3>Morning Intentions</h3>
<p>What do I want to accomplish today?</p>
<ul>
<li>Complete the project proposal by 3 PM</li>
<li>Take a 30-minute walk during lunch</li>
<li>Call mom to catch up</li>
</ul>
<h3>Gratitude</h3>
<p>Three things I'm grateful for today:</p>
<ol>
<li>A peaceful morning with my coffee</li>
<li>Good health and energy</li>
<li>Supportive friends who check in</li>
</ol>
<h3>Evening Review</h3>
<p><strong>What went well today?</strong></p>
<p>Finished the proposal early and had a great conversation with mom.</p>
<p><strong>What could be better?</strong></p>
<p>Got distracted by social media for too long in the afternoon.</p>
<p><strong>Tomorrow's priority:</strong></p>
<p>Start the day with exercise before checking my phone.</p>`,
      },
      {
        title: 'Personal Goals',
        type: 'sticky',
        content: `<h2>🎯 2025 Personal Goals</h2>
<hr/>
<h3>Health & Fitness</h3>
<ul>
<li>Exercise 4x per week</li>
<li>Drink 8 glasses of water daily</li>
<li>Sleep 7+ hours every night</li>
<li>Complete a 5K run by June</li>
</ul>
<h3>Personal Growth</h3>
<ul>
<li>Read 24 books this year</li>
<li>Learn a new skill (cooking/language)</li>
<li>Practice meditation daily</li>
<li>Journal at least 3x per week</li>
</ul>
<h3>Relationships</h3>
<ul>
<li>Schedule monthly catch-ups with close friends</li>
<li>Call family every week</li>
<li>Be more present in conversations</li>
</ul>
<h3>Financial</h3>
<ul>
<li>Save 20% of income monthly</li>
<li>Build emergency fund</li>
<li>Track all expenses</li>
</ul>`,
      },
      {
        title: 'Self-Care Checklist',
        type: 'sticky',
        content: `<h2>💆 Self-Care Checklist</h2>
<hr/>
<h3>Physical Care</h3>
<ul>
<li>☐ Got enough sleep (7-8 hours)</li>
<li>☐ Drank plenty of water</li>
<li>☐ Ate nutritious meals</li>
<li>☐ Moved my body / exercised</li>
<li>☐ Took medications/vitamins</li>
</ul>
<h3>Mental Care</h3>
<ul>
<li>☐ Practiced mindfulness/meditation</li>
<li>☐ Took breaks when needed</li>
<li>☐ Said no to something draining</li>
<li>☐ Did something creative</li>
</ul>
<h3>Emotional Care</h3>
<ul>
<li>☐ Connected with a friend</li>
<li>☐ Expressed my feelings</li>
<li>☐ Practiced self-compassion</li>
<li>☐ Did something that brings joy</li>
</ul>
<h3>This Week's Self-Care Focus</h3>
<p><strong>Priority:</strong> Getting more consistent sleep</p>
<p><strong>Reward:</strong> Weekend spa day if I meet my goal!</p>`,
      },
    ],
  },
  {
    id: 'diary-journal',
    name: 'Diary & Journal',
    icon: 'BookOpen',
    description: 'Personal diary entries, dream journal, and life memories collection',
    category: 'Diary',
    folderColor: '#a855f7',
    notes: [
      {
        title: 'Dear Diary...',
        type: 'lined',
        content: `<h2>Dear Diary</h2>
<p><strong>Date:</strong> February 8, 2025 | <strong>Mood:</strong> Hopeful ✨</p>
<hr/>
<p>Today was one of those days that reminded me why I keep going. Started the morning feeling a bit overwhelmed with everything on my plate, but then something unexpected happened...</p>

<p>I ran into an old friend at the coffee shop — someone I hadn't seen in years. We talked for almost an hour, and it felt like no time had passed at all. She reminded me of the dreams I had when we were younger, and how far I've actually come since then.</p>

<p>Sometimes I get so caught up in what I haven't achieved that I forget to celebrate what I have. This conversation was a good reminder.</p>

<h3>Highlights of Today</h3>
<ul>
<li>That surprise coffee chat</li>
<li>Finally finished the book I've been reading for months</li>
<li>Made my favorite pasta for dinner</li>
</ul>

<h3>On My Mind</h3>
<p>I've been thinking a lot about what I want the next chapter of my life to look like. Maybe it's time to start that project I've been putting off...</p>

<p><em>Until tomorrow,</em></p>
<p><em>— Me</em></p>`,
      },
      {
        title: 'Dream Journal',
        type: 'lined',
        content: `<h2>Dream Journal</h2>
<p><strong>Date:</strong> February 8, 2025 | <strong>Sleep Quality:</strong> ★★★★☆</p>
<hr/>
<h3>The Dream</h3>
<p>I was walking through a forest that seemed familiar, but I couldn't place it. The trees were incredibly tall — taller than any I've seen in real life. There was a soft golden light filtering through the leaves.</p>

<p>I came across a small cabin. Inside, there was a desk with an old typewriter and stacks of paper. When I sat down to type, the words just flowed — pages and pages of something that felt important, but I couldn't read what I was writing.</p>

<p>Someone called my name from outside. I went to the window, but when I looked out, I was suddenly in a completely different place — on a beach at sunset. I felt peaceful but also like I was searching for something I couldn't name.</p>

<h3>Emotions</h3>
<ul>
<li>Curiosity and wonder</li>
<li>A sense of purpose</li>
<li>Slight longing for something unknown</li>
</ul>

<h3>Possible Meanings</h3>
<p>The forest might represent my subconscious — unexplored parts of myself. The cabin and typewriter could relate to my desire to express myself more creatively. The beach at the end might symbolize a need for rest and clarity.</p>

<h3>Recurring Themes</h3>
<p>This is the third time this month I've dreamed about writing. Maybe it's time to start that journal or creative project I've been thinking about.</p>`,
      },
      {
        title: 'Life Memories',
        type: 'sticky',
        content: `<h2>📸 Precious Memories</h2>
<hr/>
<h3>Moments I Never Want to Forget</h3>

<p><strong>Summer 2024 — The Road Trip</strong></p>
<p>Driving down the coast with the windows down, singing terribly to old songs. We stopped at that tiny diner in the middle of nowhere and had the best pancakes of our lives.</p>

<p><strong>December 2023 — The Surprise</strong></p>
<p>When everyone showed up for my birthday even though I thought everyone had forgotten. The look on their faces when they yelled "surprise" is burned into my memory.</p>

<p><strong>That Random Tuesday</strong></p>
<p>Nothing special was supposed to happen, but we ended up staying up until 3 AM talking about life, dreams, and everything in between. Those are often the best moments — the ones you don't plan.</p>

<h3>People Who Made a Difference</h3>
<ul>
<li><strong>Mom</strong> — For always believing in me</li>
<li><strong>My best friend</strong> — For the late-night calls</li>
<li><strong>That teacher in 10th grade</strong> — Who saw potential I didn't see</li>
</ul>

<h3>Lessons from the Past</h3>
<ul>
<li>The hard times always passed</li>
<li>I'm stronger than I give myself credit for</li>
<li>The best things came when I least expected them</li>
</ul>`,
      },
    ],
  },
  {
    id: 'coding-developer',
    name: 'Developer Notes',
    icon: 'FileText',
    description: 'Code snippets, debugging notes, and technical documentation for developers',
    category: 'Coding',
    folderColor: '#22c55e',
    notes: [
      {
        title: 'Code Snippets Library',
        type: 'code',
        content: `// =============================================
// USEFUL CODE SNIPPETS LIBRARY
// =============================================

// --- JAVASCRIPT / TYPESCRIPT ---

// Debounce function
const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

// Deep clone an object
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

// Generate random ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// Format date
const formatDate = (date) => new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
}).format(new Date(date));

// --- REACT HOOKS ---

// useLocalStorage hook
const useLocalStorage = (key, initialValue) => {
  const [value, setValue] = useState(() => {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : initialValue;
  });
  
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  
  return [value, setValue];
};

// --- CSS TRICKS ---

// Center anything with flexbox
// display: flex;
// justify-content: center;
// align-items: center;

// Smooth scrolling
// scroll-behavior: smooth;

// Text truncation with ellipsis
// white-space: nowrap;
// overflow: hidden;
// text-overflow: ellipsis;

// --- GIT COMMANDS ---
// git stash save "message"
// git stash pop
// git reset --soft HEAD~1
// git cherry-pick <commit-hash>
// git log --oneline -n 10`,
      },
      {
        title: 'Bug Tracker & Debug Notes',
        type: 'code',
        content: `// =============================================
// BUG TRACKER & DEBUG NOTES
// =============================================

// --- CURRENT BUGS ---

// BUG #1: Login redirect loop
// Status: IN PROGRESS
// Priority: High
// Description: Users getting stuck in redirect loop after OAuth login
// Steps to reproduce:
//   1. Click "Login with Google"
//   2. Complete OAuth flow
//   3. Observe infinite redirect
// 
// Investigation:
//   - Checked auth callback URL ✓
//   - Session cookie being set correctly ✓
//   - Issue seems to be in the redirect logic after token validation
//
// Possible fix:
//   - Check if user session exists before redirecting
//   - Add delay before redirect check
//
// Next steps:
//   - Add console logs to track redirect flow
//   - Check browser network tab for redirect chain

// --- RESOLVED BUGS ---

// BUG #2: Images not loading in production [FIXED]
// Root cause: CORS policy blocking requests
// Solution: Added proper headers to image CDN configuration
// Date fixed: Feb 7, 2025

// --- DEBUG COMMANDS ---
// console.log('Checkpoint 1:', variable);
// debugger;
// console.table(arrayOfObjects);
// console.time('operation'); ... console.timeEnd('operation');

// --- ENVIRONMENT CHECKS ---
// console.log('NODE_ENV:', process.env.NODE_ENV);
// console.log('API_URL:', process.env.REACT_APP_API_URL);`,
      },
      {
        title: 'API Documentation',
        type: 'lined',
        content: `<h2>API Documentation</h2>
<p><strong>Project:</strong> My App API | <strong>Version:</strong> v2.0 | <strong>Base URL:</strong> https://api.myapp.com</p>
<hr/>
<h3>Authentication</h3>
<p>All API requests require a Bearer token in the Authorization header.</p>
<table><thead><tr><th>Header</th><th>Value</th></tr></thead><tbody>
<tr><td>Authorization</td><td>Bearer YOUR_API_TOKEN</td></tr>
<tr><td>Content-Type</td><td>application/json</td></tr>
</tbody></table>
<h3>Endpoints</h3>
<h4>GET /users</h4>
<p>Fetch all users with pagination.</p>
<table><thead><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr></thead><tbody>
<tr><td>page</td><td>integer</td><td>No</td><td>Page number (default: 1)</td></tr>
<tr><td>limit</td><td>integer</td><td>No</td><td>Items per page (default: 20)</td></tr>
</tbody></table>
<h4>POST /users</h4>
<p>Create a new user.</p>
<table><thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr></thead><tbody>
<tr><td>email</td><td>string</td><td>Yes</td><td>User's email address</td></tr>
<tr><td>name</td><td>string</td><td>Yes</td><td>Full name</td></tr>
<tr><td>role</td><td>string</td><td>No</td><td>user | admin (default: user)</td></tr>
</tbody></table>
<h3>Error Codes</h3>
<table><thead><tr><th>Code</th><th>Message</th><th>Description</th></tr></thead><tbody>
<tr><td>400</td><td>Bad Request</td><td>Invalid request parameters</td></tr>
<tr><td>401</td><td>Unauthorized</td><td>Missing or invalid token</td></tr>
<tr><td>403</td><td>Forbidden</td><td>Insufficient permissions</td></tr>
<tr><td>404</td><td>Not Found</td><td>Resource doesn't exist</td></tr>
<tr><td>500</td><td>Server Error</td><td>Internal server error</td></tr>
</tbody></table>
<h3>Rate Limiting</h3>
<p>API requests are limited to 100 requests per minute per API key.</p>`,
      },
    ],
  },
];

const CATEGORIES = [...new Set(DEFAULT_NOTE_TEMPLATES.map(t => t.category))];
const FOLDER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#0ea5e9', '#6366f1'];

// ─── Props ───

interface NoteTemplateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate: (data: {
    folder: Omit<Folder, 'id' | 'createdAt'>;
    notes: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'syncVersion' | 'syncStatus' | 'isDirty'>[];
  }) => void;
}

// ─── Component ───

export const NoteTemplateSheet = ({ isOpen, onClose, onApplyTemplate }: NoteTemplateSheetProps) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customTemplates, setCustomTemplates] = useState<NoteTemplate[]>([]);
  const [previewTemplate, setPreviewTemplate] = useState<NoteTemplate | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIcon, setFormIcon] = useState('Star');
  const [formFolderColor, setFormFolderColor] = useState(FOLDER_COLORS[0]);
  const [formNotes, setFormNotes] = useState<{ title: string; content: string }[]>([
    { title: '', content: '' },
  ]);

  useHardwareBackButton({ onBack: onClose, enabled: isOpen, priority: 'sheet' });

  useEffect(() => {
    getSetting<NoteTemplate[]>('customNoteTemplates', []).then(setCustomTemplates);
  }, []);

  const allTemplates = [...DEFAULT_NOTE_TEMPLATES, ...customTemplates];

  const filteredTemplates = allTemplates.filter(t => {
    const matchesSearch = !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const grouped = filteredTemplates.reduce((acc, tmpl) => {
    const cat = tmpl.isCustom ? t('noteTemplates.myTemplates') : t(`noteTemplates.categories.${tmpl.category}`, tmpl.category);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tmpl);
    return acc;
  }, {} as Record<string, NoteTemplate[]>);

  const handleApply = (template: NoteTemplate) => {
    Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});

    const noteDefs = template.notes.map(n => ({
      type: n.type,
      title: n.title,
      content: n.content,
      color: undefined as any,
      voiceRecordings: [] as any[],
      folderId: undefined, // Will be set by parent with created folder ID
    }));

    onApplyTemplate({
      folder: { name: template.name, color: template.folderColor, isDefault: false, isFavorite: true },
      notes: noteDefs,
    });

    toast.success(t('noteTemplates.notesCreated', { name: template.name }), { icon: '📝' });
    onClose();
  };

  const getIcon = (iconName: string) => ICON_MAP[iconName] || Star;
  const totalNotes = (t: NoteTemplate) => t.notes.length;

  // Save custom template
  const handleSaveCustom = () => {
    if (!formName.trim()) return;
    const newTemplate: NoteTemplate = {
      id: `custom-note-${Date.now()}`,
      name: formName.trim(),
      icon: formIcon,
      description: formDescription.trim(),
      category: 'Custom',
      folderColor: formFolderColor,
      isCustom: true,
      notes: formNotes.filter(n => n.title.trim()).map(n => ({
        title: n.title.trim(),
        type: 'regular' as NoteType,
        content: `<h2>${n.title.trim()}</h2><p>${n.content.trim() || ''}</p>`,
      })),
    };
    const updated = [...customTemplates, newTemplate];
    setCustomTemplates(updated);
    setSetting('customNoteTemplates', updated);
    setShowCreateDialog(false);
    setFormName('');
    setFormDescription('');
    setFormNotes([{ title: '', content: '' }]);
    toast.success(t('noteTemplates.templateSaved'));
  };

  const handleDeleteCustom = (id: string) => {
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    setSetting('customNoteTemplates', updated);
    toast.success(t('noteTemplates.templateDeleted'));
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] p-0">
          <SheetHeader className="px-5 pt-5 pb-3">
            <SheetTitle className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5" />
              {t('noteTemplates.title')}
            </SheetTitle>
          </SheetHeader>

          <div className="px-5 pb-3 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('noteTemplates.searchPlaceholder')}
                className="pl-9"
              />
            </div>

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors",
                  !selectedCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {t('noteTemplates.all')}
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors",
                    selectedCategory === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {t(`noteTemplates.categories.${cat}`, cat)}
                </button>
              ))}
              {customTemplates.length > 0 && (
                <button
                  onClick={() => setSelectedCategory('Custom')}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors",
                    selectedCategory === 'Custom' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {t('noteTemplates.myTemplates')}
                </button>
              )}
            </div>
          </div>

          {/* Template list */}
          <ScrollArea className="h-[50vh] px-5">
            <div className="space-y-5 pb-6">
              {Object.entries(grouped).map(([category, templates]) => (
                <div key={category}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{category}</h3>
                  <div className="space-y-2">
                    {templates.map(template => {
                      const Icon = getIcon(template.icon);
                      return (
                        <div
                          key={template.id}
                          className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => setPreviewTemplate(template)}
                        >
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: template.folderColor + '20', color: template.folderColor }}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">{t(`noteTemplates.templates.${template.id}.name`, template.name)}</p>
                              {template.isCustom && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{t('noteTemplates.custom')}</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{t(`noteTemplates.templates.${template.id}.description`, template.description)}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant="outline" className="text-[10px]">{t('noteTemplates.notesCount', { count: totalNotes(template) })}</Badge>
                            {template.isCustom && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={(e) => { e.stopPropagation(); handleDeleteCustom(template.id); }}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {filteredTemplates.length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  {t('noteTemplates.noTemplatesFound')}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Create custom button */}
          <div className="px-5 py-3 border-t" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
            <Button variant="outline" className="w-full gap-2" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4" />
              {t('noteTemplates.createCustomTemplate')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Preview / Apply dialog */}
      {previewTemplate && (
        <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {(() => { const Icon = getIcon(previewTemplate.icon); return <Icon className="h-5 w-5" />; })()}
                {t(`noteTemplates.templates.${previewTemplate.id}.name`, previewTemplate.name)}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-3 pb-4">
                <p className="text-sm text-muted-foreground">{t(`noteTemplates.templates.${previewTemplate.id}.description`, previewTemplate.description)}</p>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: previewTemplate.folderColor }} />
                  <span>{t('noteTemplates.createsFolderDesc', { name: previewTemplate.name })}</span>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('noteTemplates.notesIncluded', { count: previewTemplate.notes.length })}
                  </p>
                  {previewTemplate.notes.map((note, i) => (
                    <div key={i} className="p-3 rounded-lg border bg-muted/30">
                      <p className="font-medium text-sm flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        {note.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {note.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').slice(0, 120)}...
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" className="flex-1" onClick={() => setPreviewTemplate(null)}>
                {t('common.cancel')}
              </Button>
              <Button className="flex-1 gap-2" onClick={() => { handleApply(previewTemplate); setPreviewTemplate(null); }}>
                <Plus className="h-4 w-4" />
                {t('noteTemplates.createNotes')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Custom Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('noteTemplates.createNoteTemplate')}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 pb-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('noteTemplates.templateName')}</label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder={t('noteTemplates.templateNamePlaceholder')} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('noteTemplates.descriptionLabel')}</label>
                <Input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder={t('noteTemplates.descriptionPlaceholder')} />
              </div>

              {/* Icon selector */}
              <div>
                <label className="text-sm font-medium mb-1 block">{t('noteTemplates.iconLabel')}</label>
                <div className="flex gap-1 flex-wrap">
                  {ICON_OPTIONS.map(icon => {
                    const I = ICON_MAP[icon];
                    return (
                      <button
                        key={icon}
                        onClick={() => setFormIcon(icon)}
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center border transition-colors",
                          formIcon === icon ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-transparent"
                        )}
                      >
                        <I className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Folder color */}
              <div>
                <label className="text-sm font-medium mb-1 block">{t('noteTemplates.folderColor')}</label>
                <div className="flex gap-2">
                  {FOLDER_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setFormFolderColor(c)}
                      className={cn("w-7 h-7 rounded-full border-2 transition-all", formFolderColor === c ? "border-foreground scale-110" : "border-transparent")}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium mb-1 block">{t('noteTemplates.notesPerEntry')}</label>
                <div className="space-y-3">
                  {formNotes.map((note, i) => (
                    <div key={i} className="p-3 rounded-lg border space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={note.title}
                          onChange={e => {
                            const updated = [...formNotes];
                            updated[i].title = e.target.value;
                            setFormNotes(updated);
                          }}
                          placeholder={t('noteTemplates.noteTitlePlaceholder', { number: i + 1 })}
                          className="flex-1"
                        />
                        {formNotes.length > 1 && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 flex-shrink-0"
                            onClick={() => setFormNotes(formNotes.filter((_, j) => j !== i))}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <Textarea
                        value={note.content}
                        onChange={e => {
                          const updated = [...formNotes];
                          updated[i].content = e.target.value;
                          setFormNotes(updated);
                        }}
                        placeholder={t('noteTemplates.noteContentPlaceholder')}
                        rows={2}
                      />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => setFormNotes([...formNotes, { title: '', content: '' }])}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('noteTemplates.addNote')}
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" className="flex-1" onClick={() => setShowCreateDialog(false)}>{t('common.cancel')}</Button>
            <Button className="flex-1" onClick={handleSaveCustom} disabled={!formName.trim()}>{t('noteTemplates.saveTemplate')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
