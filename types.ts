import React from 'react';

export type FieldType = 'short_text' | 'long_text' | 'number' | 'checkbox' | 'radio' | 'select' | 'date' | 'tab_group' | 'multi_line' | 'repeating_group' | 'file_upload';
export type FieldWidth = 'full' | 'half';
export type EventTrigger = 'onChange' | 'onBlur';
export type ActionType = 'ajax_request';

export interface FormAction {
  type: ActionType;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
}

export interface FieldEvent {
  trigger: EventTrigger;
  action: FormAction;
}

export interface FormTab {
  id: string;
  label: string;
  fields: FormField[];
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  propertyName?: string; // The database column key or JSON key
  placeholder?: string;
  required: boolean;
  width?: FieldWidth;
  options?: string[]; // For radio, select
  helperText?: string;
  events?: FieldEvent[];
  tabs?: FormTab[]; // For tab_group
  subFields?: FormField[]; // For repeating_group (columns)
}

export interface FormSchema {
  title: string;
  description?: string;
  fields: FormField[];
}

export type IconProps = React.SVGProps<SVGSVGElement>;