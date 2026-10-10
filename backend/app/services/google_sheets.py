import json
import logging
import uuid
import re
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from google.oauth2 import service_account
from googleapiclient.discovery import build

from app.config import settings

logger = logging.getLogger("business_intel_api")

class GoogleSheetsService:
    def __init__(self):
        self.service_account_info = settings.GOOGLE_SERVICE_ACCOUNT_INFO
        self.is_live = False
        self.creds = None
        self.client_email = None

        if self.service_account_info:
            try:
                info = json.loads(self.service_account_info)
                self.client_email = info.get("client_email")
                self.creds = service_account.Credentials.from_service_account_info(
                    info,
                    scopes=[
                        "https://www.googleapis.com/auth/spreadsheets",
                        "https://www.googleapis.com/auth/drive"
                    ]
                )
                self.is_live = True
                logger.info(f"[sheets] Google Sheets Service initialized. Service Account: {self.client_email}")
            except Exception as e:
                logger.error(f"[sheets] Failed to load Google Service Account credentials: {e}")

        if not self.is_live:
            logger.warning("[sheets] Google Service Account credentials missing. Google Sheets integration is disabled.")

    def _get_val(self, obj: Any, key: str, default: Any = "") -> Any:
        if hasattr(obj, key):
            return getattr(obj, key)
        if isinstance(obj, dict):
            return obj.get(key, default)
        return default

    def _format_lead_rows(self, leads: List[Any]) -> List[List[Any]]:
        headers = [
            "Business Name", "Category", "Address", "Rating", "Reviews Count",
            "Phone Number", "Website URL", "Email Address", "Social Media Links",
            "Contact Page URL", "Tech Stack", "Lead Score", "Sales Opportunity Score",
            "Worth Contacting", "Estimated Size", "About Summary"
        ]
        
        rows = [headers]
        for lead in leads:
            emails = self._get_val(lead, "emails")
            emails_str = ", ".join(emails) if isinstance(emails, list) else str(emails or "")
            
            socials = self._get_val(lead, "social_links")
            socials_str = ", ".join(socials) if isinstance(socials, list) else str(socials or "")
            
            techs = self._get_val(lead, "tech_stack")
            techs_str = ", ".join(techs) if isinstance(techs, list) else str(techs or "")

            worth_contacting = self._get_val(lead, "worth_contacting")
            worth_str = "Yes" if worth_contacting is True or worth_contacting == "Yes" else "No"
            
            rows.append([
                str(self._get_val(lead, "business_name")),
                str(self._get_val(lead, "category")),
                str(self._get_val(lead, "address")),
                str(self._get_val(lead, "rating") or "---"),
                int(self._get_val(lead, "reviews_count") or 0),
                str(self._get_val(lead, "phone")),
                str(self._get_val(lead, "website")),
                emails_str,
                socials_str,
                str(self._get_val(lead, "contact_page")),
                techs_str,
                str(self._get_val(lead, "lead_score") or "---"),
                str(self._get_val(lead, "sales_opportunity_score") or "---"),
                worth_str,
                str(self._get_val(lead, "estimated_size") or "Medium"),
                str(self._get_val(lead, "about_summary"))
            ])
        return rows

    def extract_spreadsheet_id(self, url_or_id: str) -> str:
        """Parses spreadsheet ID from a raw text input or Google Spreadsheet URL."""
        if not url_or_id:
            return ""
        clean = url_or_id.strip()
        # Regex to parse sheet ID from Google Sheets URL
        match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", clean)
        if match:
            return match.group(1)
        return clean

    def export_leads(
        self, 
        leads: List[Any], 
        mode: str, 
        user_email: str, 
        spreadsheet_name: Optional[str] = None, 
        spreadsheet_id: Optional[str] = None,
        worksheet_name: Optional[str] = None,
        create_worksheet: Optional[bool] = False
    ) -> Tuple[str, str]:
        """
        Exports leads to Google Sheets. Returns a tuple: (spreadsheet_url, status_message)
        """
        if not self.is_live:
            raise RuntimeError(
                "Google Sheets Sync is not configured. Please add your service account credentials "
                "to the GOOGLE_SERVICE_ACCOUNT_INFO environment variable."
            )

        rows = self._format_lead_rows(leads)

        try:
            sheets_service = build("sheets", "v4", credentials=self.creds)
            
            if mode == "existing":
                sheet_id = self.extract_spreadsheet_id(spreadsheet_id)
                if not sheet_id:
                    raise ValueError("A valid Google Sheet URL or Spreadsheet ID must be specified.")
                
                # Fetch sheet metadata to find existing worksheets
                sheet_metadata = sheets_service.spreadsheets().get(spreadsheetId=sheet_id).execute()
                sheets = sheet_metadata.get('sheets', [])
                existing_titles = [s['properties']['title'] for s in sheets]
                
                # Determine target worksheet name
                target_sheet = worksheet_name
                if not target_sheet:
                    target_sheet = sheets[0]['properties']['title'] if sheets else 'Sheet1'

                # Auto-create tab if requested and doesn't exist
                if create_worksheet and target_sheet not in existing_titles:
                    body = {
                        "requests": [
                            {
                                "addSheet": {
                                    "properties": {
                                        "title": target_sheet
                                    }
                                }
                            }
                        ]
                    }
                    sheets_service.spreadsheets().batchUpdate(spreadsheetId=sheet_id, body=body).execute()

                # Check if target spreadsheet tab has any content
                try:
                    res_values = sheets_service.spreadsheets().values().get(
                        spreadsheetId=sheet_id,
                        range=f"'{target_sheet}'!A1:E10"
                    ).execute()
                    existing_values = res_values.get("values", [])
                except Exception:
                    existing_values = []
                
                has_content = False
                for r_row in existing_values:
                    if any(str(cell).strip() for cell in r_row if cell is not None and cell != ""):
                        has_content = True
                        break
                is_empty = not has_content

                if is_empty:
                    # Write headers and all values
                    body = {
                        "values": rows
                    }
                    sheets_service.sheets = sheets_service.spreadsheets().values().update(
                        spreadsheetId=sheet_id,
                        range=f"'{target_sheet}'!A1",
                        valueInputOption="RAW",
                        body=body
                    ).execute()
                else:
                    # Append rows (excluding headers)
                    body = {
                        "values": rows[1:]
                    }
                    sheets_service.spreadsheets().values().append(
                        spreadsheetId=sheet_id,
                        range=f"'{target_sheet}'!A1",
                        valueInputOption="RAW",
                        insertDataOption="INSERT_ROWS",
                        body=body
                    ).execute()

                url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/edit"
                msg = f"Appended {len(leads)} leads successfully to worksheet '{target_sheet}'!"
                return url, msg

            else:
                # Create a new spreadsheet
                name = spreadsheet_name or f"Discovery Leads - {datetime.utcnow().strftime('%Y-%m-%d')}"
                target_sheet = worksheet_name or 'Sheet1'
                
                body = {
                    "properties": {
                        "title": name
                    },
                    "sheets": [
                        {
                            "properties": {
                                "title": target_sheet
                            }
                        }
                    ]
                }
                spreadsheet = sheets_service.spreadsheets().create(
                    body=body, 
                    fields="spreadsheetId,spreadsheetUrl"
                ).execute()
                
                new_sheet_id = spreadsheet.get("spreadsheetId")
                new_sheet_url = spreadsheet.get("spreadsheetUrl")

                # Populate headers and rows in new sheet
                body_values = {
                    "values": rows
                }
                sheets_service.spreadsheets().values().update(
                    spreadsheetId=new_sheet_id,
                    range=f"'{target_sheet}'!A1",
                    valueInputOption="RAW",
                    body=body_values
                ).execute()

                # Share sheet with the user via Drive API
                try:
                    drive_service = build("drive", "v3", credentials=self.creds)
                    drive_service.permissions().create(
                        fileId=new_sheet_id,
                        body={
                            "type": "user",
                            "role": "writer",
                            "emailAddress": user_email
                        },
                        fields="id"
                    ).execute()
                    msg = f"Created new Google Sheet '{name}' and shared access with {user_email}!"
                except Exception as share_err:
                    logger.warning(f"[sheets] Drive API sharing failed: {share_err}")
                    msg = f"Created new Google Sheet '{name}'. Please ask admin to share ID: {new_sheet_id}."

                return new_sheet_url, msg

        except Exception as err:
            logger.error(f"[sheets] Export failed with error: {err}", exc_info=True)
            raise RuntimeError(f"Google Sheets Sync failed: {str(err)}")

google_sheets_service = GoogleSheetsService()
