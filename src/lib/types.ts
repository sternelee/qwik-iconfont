export interface Project {
  id: number;
  name: string;
  description: string | null;
  font_family: string;
  prefix: string;
  icon_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Icon {
  id: number;
  project_id: number;
  name: string;
  unicode: string | null;
  svg_path: string;
  view_box: string | null;
  width: number | null;
  height: number | null;
  content: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithIcons extends Project {
  icons: Icon[];
}

export interface IconUpload {
  name: string;
  content: string;
  unicode?: string;
}
