import { GoogleGenAI, Type } from "@google/genai";
import { FormField } from "../types";

const apiKey = process.env.API_KEY;

// Initialize the client
const ai = new GoogleGenAI({ apiKey: apiKey });

export const generateFormSchema = async (prompt: string): Promise<FormField[]> => {
  if (!apiKey) {
    console.warn("API Key is missing. AI generation will fail.");
    throw new Error("API Key is missing");
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Create a comprehensive form structure based on this description: "${prompt}". 
      Ensure the fields are logical and cover necessary data points inferred from the description.
      Assign 'half' width to short fields that naturally sit side-by-side (e.g., First Name/Last Name, Phone/Email, City/Zip) and 'full' width to others.
      
      Use "multi_line" for fields where the user needs to provide a simple list of text items (e.g., "Key Skills", "References").
      Use "repeating_group" for complex lists where each item has multiple properties (e.g., "Invoice Items" with Item Name, Qty, Price; or "Work History" with Company, Role, Dates).
      Use "file_upload" for fields requiring document, image, or file attachments (e.g. "Resume", "Profile Picture", "Receipt").
      For "repeating_group", define the columns in the "subFields" array.
      If the form is complex or has distinct sections (like "Personal Details", "Employment History"), use a "tab_group" to organize them into tabs.
      Do not nest tabs inside other tabs.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                enum: ["short_text", "long_text", "number", "checkbox", "radio", "select", "date", "tab_group", "multi_line", "repeating_group", "file_upload"],
                description: "The HTML input type. 'repeating_group' for tables of data. 'file_upload' for attachments."
              },
              label: {
                type: Type.STRING,
                description: "The label for the input, tab group, or repeating group."
              },
              placeholder: {
                type: Type.STRING,
                description: "Placeholder text."
              },
              required: {
                type: Type.BOOLEAN,
                description: "Whether the field is mandatory."
              },
              width: {
                type: Type.STRING,
                enum: ["full", "half"],
                description: "Layout width."
              },
              helperText: {
                type: Type.STRING,
                description: "Short help text."
              },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Options for select, radio, or checklist."
              },
              subFields: {
                type: Type.ARRAY,
                description: "Only for 'repeating_group'. Defines the columns of the table.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING, enum: ["short_text", "number", "select", "date", "checkbox", "file_upload"] },
                    label: { type: Type.STRING },
                    placeholder: { type: Type.STRING },
                    required: { type: Type.BOOLEAN },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ["type", "label"]
                }
              },
              tabs: {
                type: Type.ARRAY,
                description: "Only for type 'tab_group'. Contains the tabs and their fields.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING, description: "Tab name (e.g. 'Personal Info')" },
                    fields: {
                      type: Type.ARRAY,
                      description: "Fields inside this tab",
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          type: { type: Type.STRING, enum: ["short_text", "long_text", "number", "checkbox", "radio", "select", "date", "multi_line", "repeating_group", "file_upload"] },
                          label: { type: Type.STRING },
                          placeholder: { type: Type.STRING },
                          required: { type: Type.BOOLEAN },
                          width: { type: Type.STRING, enum: ["full", "half"] },
                          options: { type: Type.ARRAY, items: { type: Type.STRING } },
                          helperText: { type: Type.STRING },
                          subFields: {
                             type: Type.ARRAY,
                             description: "Nested columns for repeating groups inside tabs",
                             items: {
                                type: Type.OBJECT,
                                properties: {
                                  type: { type: Type.STRING, enum: ["short_text", "number", "select", "date", "checkbox", "file_upload"] },
                                  label: { type: Type.STRING },
                                  placeholder: { type: Type.STRING },
                                  required: { type: Type.BOOLEAN },
                                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                },
                                required: ["type", "label"]
                             }
                          }
                        },
                        required: ["type", "label"]
                      }
                    }
                  },
                  required: ["label", "fields"]
                }
              }
            },
            required: ["type", "label"]
          }
        }
      }
    });

    const rawFields = JSON.parse(response.text || "[]");
    
    // Helper to process fields recursively and add IDs
    const processFields = (fields: any[]): FormField[] => {
      return fields.map(field => ({
        ...field,
        id: crypto.randomUUID(),
        options: field.options || [],
        width: field.width || 'full',
        required: !!field.required,
        subFields: field.subFields ? processFields(field.subFields) : undefined,
        tabs: field.tabs ? field.tabs.map((tab: any) => ({
          id: crypto.randomUUID(),
          label: tab.label,
          fields: processFields(tab.fields || [])
        })) : undefined
      }));
    };

    return processFields(rawFields);

  } catch (error) {
    console.error("Error generating form:", error);
    throw error;
  }
};

export const generateSQLSchema = async (fields: FormField[], dbType: string, tableName: string): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing");
  }

  // Simplify fields for the prompt to save tokens and reduce noise
  const simplifyField = (f: FormField): any => ({
    label: f.label,
    type: f.type,
    required: f.required,
    subFields: f.subFields?.map(sf => ({ label: sf.label, type: sf.type })),
    tabs: f.tabs?.map(t => ({ label: t.label, fields: t.fields.map(simplifyField) }))
  });

  const simplifiedFields = fields.map(simplifyField);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
      Act as a Senior Database Architect. Convert the following Form Schema (JSON) into a production-ready SQL CREATE TABLE statement.
      
      Target Database System: ${dbType}
      Table Name: ${tableName}
      
      Schema Definition (JSON):
      ${JSON.stringify(simplifiedFields, null, 2)}
      
      Rules:
      1. Use appropriate data types for the target database (e.g., VARCHAR, TEXT, INT, BOOLEAN, TIMESTAMP).
      2. Add a primary key 'id' (auto-increment/serial/uuid as appropriate for the DB type).
      3. Add 'created_at' and 'updated_at' timestamps with default values.
      4. Handle 'repeating_group' and 'tab_group' intelligently:
         - For 'repeating_group', prefer using a JSON/JSONB column if the DB supports it (like PostgreSQL/MySQL 8). If not, assume a TEXT field to store stringified JSON.
         - Flatten 'tab_group' fields into the main table, but prefix their columns with a shortened tab name if necessary to avoid collisions, or just list them as standard columns.
      5. Sanitize column names (snake_case, lowercase).
      6. Add comments to columns based on the field labels.
      7. Output ONLY the SQL code. Do not include markdown code fences (\`\`\`).
      `,
    });

    return response.text || "-- No SQL generated";
  } catch (error) {
    console.error("Error generating SQL:", error);
    return "-- Error generating SQL schema. Please try again.";
  }
};