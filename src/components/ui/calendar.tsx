import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { getWeek } from "date-fns";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  showWeekNumbers?: boolean;
};

function Calendar({ className, classNames, showOutsideDays = true, showWeekNumbers = false, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      showWeekNumber={showWeekNumbers}
      className={cn("p-3 pointer-events-auto", className)}
      style={{ fontFamily: "'Outfit', sans-serif" }}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-lg font-medium tracking-tight",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 bg-transparent p-0 hover:bg-muted/60 rounded-full",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell: "text-muted-foreground/70 rounded-md w-10 font-normal text-xs uppercase tracking-wide",
        row: "flex w-full mt-1",
        cell: cn(
          "h-10 w-10 text-center p-0 relative",
          "[&:has([aria-selected].day-range-end)]:rounded-r-md",
          "[&:has([aria-selected].day-outside)]:bg-accent/50",
          "[&:has([aria-selected])]:bg-accent",
          "first:[&:has([aria-selected])]:rounded-l-md",
          "last:[&:has([aria-selected])]:rounded-r-md",
          "focus-within:relative focus-within:z-20"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 p-0 text-base aria-selected:opacity-100 rounded-full transition-colors",
          "font-normal [font-weight:400_!important]"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-full font-normal [font-weight:400_!important]",
        day_today: "bg-accent text-accent-foreground font-normal [font-weight:400_!important]",
        day_outside:
          "day-outside text-muted-foreground/40 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30 font-normal [font-weight:400_!important]",
        day_disabled: "text-muted-foreground/30 font-normal [font-weight:400_!important]",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground font-normal [font-weight:400_!important]",
        day_hidden: "invisible",
        weeknumber: "text-xs text-muted-foreground w-8 flex items-center justify-center font-normal",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-5 w-5" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-5 w-5" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
