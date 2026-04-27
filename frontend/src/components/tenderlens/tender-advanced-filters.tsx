"use client";

import * as React from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { TLButton } from "@/components/tenderlens/button";
import type {
  TenderAdvancedFilters,
  TenderFilterOptions,
} from "@/lib/tenders.types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";

const tenderTypeOptions = [
  "Request for Bid (Open-Tender)",
  "Request for Bid (Limited-Tender)",
  "Request for Quotation",
  "Request for Information",
  "Request for Proposal",
  "Expression of Interest",
  "SITA Contract",
  "Transversal Contract",
  "Participation",
  "Deviation",
];

function selectedOptions(event: React.ChangeEvent<HTMLSelectElement>) {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

function mergeOptions(primary: string[], fallback: string[]) {
  return Array.from(new Set([...primary, ...fallback])).filter(Boolean);
}

export function hasActiveFilters(filters: TenderAdvancedFilters) {
  return (
    filters.categories.length > 0 ||
    filters.provinces.length > 0 ||
    filters.organsOfState.length > 0 ||
    filters.tenderTypes.length > 0 ||
    filters.tenderNumber.trim().length > 0 ||
    filters.eSubmission.length > 0
  );
}

function MultiSelect(props: {
  label: string;
  placeholder: string;
  value: string[];
  options: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium text-foreground">{props.label}</span>
      <select
        multiple
        value={props.value}
        onChange={(event) => props.onChange(selectedOptions(event))}
        className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option disabled value="">
          {props.placeholder}
        </option>
        {props.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TenderAdvancedFiltersPanel(props: {
  filters: TenderAdvancedFilters;
  options: TenderFilterOptions;
  onChange: (filters: TenderAdvancedFilters) => void;
  onReset: () => void;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const filtersActive = hasActiveFilters(props.filters);
  const tenderTypes = mergeOptions(props.options.tenderTypes, tenderTypeOptions);

  function update(patch: Partial<TenderAdvancedFilters>) {
    props.onChange({ ...props.filters, ...patch });
  }

  return (
    <div className="border-b">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {props.leading}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <TLButton
                type="button"
                variant="outline"
                size="sm"
                aria-expanded={open}
              >
                <SlidersHorizontal className="mr-2 size-4" />
                Advanced search filters
                <ChevronDown
                  className={`ml-2 size-4 transition-transform ${open ? "rotate-180" : ""}`}
                />
                {filtersActive ? (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    Active
                  </span>
                ) : null}
              </TLButton>
            </SheetTrigger>
            <SheetContent side="right" className="flex flex-col w-full sm:max-w-md p-0">
              <SheetHeader className="px-6 py-4 border-b">
                <SheetTitle>Advanced Filters</SheetTitle>
                <SheetDescription>
                  Refine your tender search using multiple criteria.
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                <MultiSelect
                  label="Category"
                  placeholder="Any Category(s)"
                  value={props.filters.categories}
                  options={props.options.categories}
                  onChange={(categories) => update({ categories })}
                />
                <MultiSelect
                  label="Provinces"
                  placeholder="Any Province(s)"
                  value={props.filters.provinces}
                  options={props.options.provinces}
                  onChange={(provinces) => update({ provinces })}
                />
                <MultiSelect
                  label="Organ of State"
                  placeholder="Any Organ of State(s)"
                  value={props.filters.organsOfState}
                  options={props.options.organsOfState}
                  onChange={(organsOfState) => update({ organsOfState })}
                />
                <label className="space-y-1.5 text-sm block">
                  <span className="font-medium text-foreground">
                    Search by Tender Number
                  </span>
                  <input
                    value={props.filters.tenderNumber}
                    onChange={(event) => update({ tenderNumber: event.target.value })}
                    placeholder="Enter Tender Number"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <MultiSelect
                  label="Tender Type"
                  placeholder="Any Tender Type(s)"
                  value={props.filters.tenderTypes}
                  options={tenderTypes}
                  onChange={(tenderTypesValue) =>
                    update({ tenderTypes: tenderTypesValue })
                  }
                />
                <label className="space-y-1.5 text-sm block">
                  <span className="font-medium text-foreground">eSubmissions</span>
                  <select
                    value={props.filters.eSubmission}
                    onChange={(event) =>
                      update({
                        eSubmission: event.target.value as TenderAdvancedFilters["eSubmission"],
                      })
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Any eSubmission status</option>
                    <option value="accepting">Accepting eSubmissions</option>
                    <option value="not_accepting">Not Accepting eSubmissions</option>
                  </select>
                </label>
              </div>
              <SheetFooter className="px-6 py-4 border-t bg-muted/20">
                <div className="flex w-full gap-3">
                  <TLButton
                    variant="outline"
                    className="flex-1"
                    onClick={props.onReset}
                    disabled={!filtersActive}
                  >
                    <X className="mr-2 size-4" />
                    Reset All
                  </TLButton>
                  <SheetClose asChild>
                    <TLButton className="flex-1">View Results</TLButton>
                  </SheetClose>
                </div>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          {filtersActive ? (
            <TLButton type="button" variant="ghost" size="sm" onClick={props.onReset}>
              <X className="mr-2 size-4" />
              Clear filters
            </TLButton>
          ) : null}
        </div>
        {props.trailing}
      </div>
    </div>
  );
}

export function emptyTenderAdvancedFilters(): TenderAdvancedFilters {
  return {
    categories: [],
    provinces: [],
    organsOfState: [],
    tenderNumber: "",
    tenderTypes: [],
    eSubmission: "",
  };
}

export function parseTenderAdvancedFilters(
  searchParams: URLSearchParams,
): TenderAdvancedFilters {
  const split = (key: string) =>
    (searchParams.get(key) ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

  return {
    categories: split("categories"),
    provinces: split("provinces"),
    organsOfState: split("organsOfState"),
    tenderNumber: searchParams.get("tenderNumber") ?? "",
    tenderTypes: split("tenderTypes"),
    eSubmission:
      searchParams.get("eSubmission") === "accepting" ||
      searchParams.get("eSubmission") === "not_accepting"
        ? (searchParams.get("eSubmission") as TenderAdvancedFilters["eSubmission"])
        : "",
  };
}
