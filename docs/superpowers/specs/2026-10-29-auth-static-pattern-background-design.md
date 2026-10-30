# Tavvi — photographic restaurant authentication hero

**Status:** implemented and visually reviewed  
**Date:** 2026-10-29  
**Project:** tavvi-app  
**Scope:** desktop hero background for shared admin login and account creation

## Intent

Use a photorealistic, studio-lit restaurant still life as the background of the shared desktop authentication hero. The photo emphasizes restaurant service, with a subtle laptop cue for technology and a paper order slip for management. A dark, soft veil keeps the scene secondary to the login copy. The image is contained entirely in the left hero; the form panel stays plain and the mobile composition remains unchanged.

## Visual direction

- Use the generated square photograph in `public/images/auth/login-hero.png`: handmade plate and seasonal food, limestone table, cutlery, olive linen, paper order chit, and a cropped open graphite laptop entering from the left.
- Preserve its darker color grade and light diffusion so the objects remain visible without becoming the primary content. Add a 1 px CSS blur and a 2% scale to the image layer, then blend a 10 px backdrop blur at 40% opacity above it. Keep the theme-aware dark scrim and bottom gradient above both image layers.
- Keep the image full-bleed only inside the left hero `aside`, cropped with `object-fit: cover`. Clip the scaled blur inside the aside. No pixels or effects from it may appear behind the form.
- Keep the existing concise hero headline “Seu restaurante, em ordem.” above the photo, with sufficient contrast in both themes.
- Avoid additional devices, decorative graphics, readable generated text, animation, mouse interaction, or background effects.

## Theme and responsive behavior

- Use CSS theme tokens in the image scrim so the photo remains subdued and the logo/headline stay readable in light and dark themes.
- Render the image only with the existing desktop hero; the `aside` remains hidden below the `md` breakpoint. Preserve the current mobile layout and visual treatment.
- Render with Next.js `Image` using `fill`, responsive `sizes`, an empty alt description, and pointer-transparent styling for optimization and accessibility.

## Architecture

- Store the selected generated image in the project’s `public/images/auth` folder and render it directly inside the hero `aside` with Next.js `Image`.
- Keep the photograph decorative and server-rendered; use CSS only for responsive cropping, blur/scale, and theme-specific scrim opacity. The blur overlay reuses the same image and adds no asset.
- Remove the WebGL renderer, GLSL shaders, canvas fallback, pointer tracking, reduced-motion state, theme observer, and animation frame lifecycle.
- Remove decorative entrance and feedback fades from the shared auth shell and login/registration alerts. Remove the auth-only `MotionConfig` wrapper after its consumers are gone.
- Remove the `motion` package from direct dependencies if the auth changes leave no remaining source imports anywhere in the app.
- Preserve authentication behavior, form layout, validation, pending labels, and functional pending spinners. Keep instant focus and hover states on controls; they remain ordinary control feedback and do not affect the background.

## Acceptance criteria

- Login and account-creation desktop routes share the same photorealistic hero image and existing headline.
- The photo reads as restaurant first, with management and technology represented by secondary props.
- The image remains subdued and softly diffused in light and dark themes and is fully absent from the form panel.
- The mobile composition is unchanged and the image is not visible below 768 px.
- No canvas, WebGL, shader, animation loop, pointer listener, theme observer, or motion wrapper remains in the auth background or decorative auth-shell/alert entrances.
- The image is absent from the accessibility tree and does not intercept pointer or keyboard interaction.
- Login, registration, validation, and pending states keep their existing behavior.

## Out of scope

- Changing account-creation copy, logo usage, form fields, routes, or authentication actions.
- Changing shared button/input focus or hover styling outside the auth background.
- Adding dependencies, raster assets, animation, or browser event handling.
- Changing other admin or public pages.

## Supersedes

This revision replaces the animated liquid direction and both superseded vector directions. Earlier specs and plans are retained as history.
