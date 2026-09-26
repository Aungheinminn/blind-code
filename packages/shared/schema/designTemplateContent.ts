export type DesignTemplateColor = string;

export type DesignTemplateDimension = string | number;

export type DesignTemplateTypography = {
  fontFamily?: string;
  fontSize?: DesignTemplateDimension;
  fontWeight?: number | string;
  lineHeight?: DesignTemplateDimension;
  letterSpacing?: DesignTemplateDimension;
  fontFeature?: string;
  fontVariation?: string;
};

export type DesignTemplateOmittedEntry =
  | string
  | { section: string; reason?: string };

export type DesignTemplateComponents = Record<string, Record<string, string>>;

export type DesignTemplateFrontmatter = {
  version?: string;
  name: string;
  description?: string;
  omitted?: DesignTemplateOmittedEntry[];
  colors?: Record<string, DesignTemplateColor>;
  typography?: Record<string, DesignTemplateTypography>;
  rounded?: Record<string, DesignTemplateDimension>;
  spacing?: Record<string, DesignTemplateDimension>;
  components?: DesignTemplateComponents;
};

export type DesignTemplateParsed = {
  tokens: DesignTemplateFrontmatter;
  body: string;
  sections: string[];
  warnings: string[];
};
