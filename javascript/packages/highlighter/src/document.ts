export type StyleRole =
  | { kind: "Plain" }
  | { kind: "Token"; tokenType: string }
  | { kind: "RubyKeyword" }
  | { kind: "TagName" }
  | { kind: "AttributeName" }
  | { kind: "AttributeValue" }
  | { kind: "CommentInterior" }

export interface StyledRun {
  text: string
  role: StyleRole
}
