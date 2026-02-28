use std::collections::HashMap;
use std::sync::LazyLock;

pub static SVG_CAMEL_CASE_ELEMENTS: LazyLock<Vec<&'static str>> = LazyLock::new(|| {
  vec![
    "animateMotion",
    "animateTransform",
    "clipPath",
    "feBlend",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feDistantLight",
    "feDropShadow",
    "feFlood",
    "feFuncA",
    "feFuncB",
    "feFuncG",
    "feFuncR",
    "feGaussianBlur",
    "feImage",
    "feMerge",
    "feMergeNode",
    "feMorphology",
    "feOffset",
    "fePointLight",
    "feSpecularLighting",
    "feSpotLight",
    "feTile",
    "feTurbulence",
    "foreignObject",
    "glyphRef",
    "linearGradient",
    "radialGradient",
    "textPath",
  ]
});

pub static SVG_LOWERCASE_TO_CAMELCASE: LazyLock<HashMap<String, &'static str>> =
  LazyLock::new(|| SVG_CAMEL_CASE_ELEMENTS.iter().map(|element| (element.to_lowercase(), *element)).collect());
