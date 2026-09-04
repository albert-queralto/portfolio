# Portfolio GA4 event tracking

This portfolio sends custom GA4 events only when analytics consent is `granted`.
The event layer never reads or sends contact-form names, email addresses, message text,
or honeypot values.

## Events

| Event | Trigger | Useful parameters |
| --- | --- | --- |
| `project_view` | A project case-study page is viewed | `content_id`, `content_title`, `content_type`, `previous_path` |
| `project_live_demo_click` | A tagged live application/preview link is clicked | `content_id`, `content_title`, `content_type`, `link_location` |
| `github_click` | Any GitHub link is clicked | content context when available, `link_location` |
| `linkedin_click` | Any LinkedIn link is clicked | content context when available, `link_location` |
| `cv_download` | An internal link ending in `/CV.pdf` is clicked | content context when available, `link_location` |
| `contact_start` | The visitor first types in the contact form | `content_type=contact_form`, `content_id=contact` |
| `contact_submit` | Formspree confirms a successful contact submission | `content_type=contact_form`, `content_id=contact` |
| `blog_view` | A blog-post page is viewed | `content_id`, `content_title`, `content_type`, `previous_path` |
| `blog_75_percent` | The viewport reaches 75% of the article body | blog content context, `scroll_percent=75`, `previous_path` |
| `email_click` | A `mailto:` link is clicked | content context when available, `link_location` |

`previous_path` is deliberately limited to an internal pathname or the labels
`(direct)` / `(external)`. External referrer URLs and query strings are not copied into
this custom parameter.

## GA4 custom definitions

The events arrive in GA4 without creating custom definitions, and you can inspect them in
Realtime and DebugView. To make the parameters convenient in Explorations and custom
reports, create these event-scoped custom dimensions:

| Dimension name | Scope | Event parameter |
| --- | --- | --- |
| Content ID | Event | `content_id` |
| Content title | Event | `content_title` |
| Content type | Event | `content_type` |
| Link location | Event | `link_location` |
| Previous path | Event | `previous_path` |

`scroll_percent` does not need a custom definition for the current implementation because
`blog_75_percent` always means the same 75% threshold. Add a custom metric later only if
you expand the implementation to multiple percentages.

## Recommended key event

Mark `contact_submit` as a GA4 key event. It represents the strongest portfolio conversion
because it is sent only after Formspree returns a successful response.

Optionally mark `cv_download` as a key event if the CV is enabled and recruitment is a
primary portfolio objective.

## Useful explorations

### Which projects attract the most attention?

Create a free-form exploration:

- Rows: Content ID
- Columns or filter: Event name
- Events: `project_view`, `project_live_demo_click`
- Values: Event count and Total users

A useful derived comparison is live-demo clicks divided by project views.

### Do visitors read the case study before opening the app?

Create a funnel:

1. `project_view`
2. `project_live_demo_click`

Break down by Content ID.

### Which blog posts lead to projects?

Use `project_view` and break down by `previous_path`. A value such as
`/blog/payrithm/` followed by project `payrithm` shows an immediate blog-to-case-study
transition.

### Does the contact form convert?

Create a funnel:

1. `contact_start`
2. `contact_submit`

The completion rate is the form conversion rate among people who started typing.

### Do visitors actually read articles?

Compare `blog_view` with `blog_75_percent`, broken down by Content ID.

## Testing

1. Deploy the site and open it in a private browser window.
2. Accept analytics consent.
3. Open Google Tag Assistant or GA4 DebugView.
4. Visit a project page and confirm `project_view`.
5. Click its live application and confirm `project_live_demo_click`.
6. Visit a blog article, scroll through 75% of the article body, and confirm
   `blog_75_percent`.
7. Type into the contact form and confirm `contact_start` fires once.
8. Submit a valid message and confirm `contact_submit` only after the successful response.
9. Test GitHub, LinkedIn, CV (when enabled), and `mailto:` links.
10. Reject analytics and repeat a few interactions. These custom events should no longer be
    sent.

## Recruitment attribution

GA4 cannot inherently know that a visitor is a recruiter. For links you control—for
example in job applications, your LinkedIn profile, or outreach—use UTM-tagged portfolio
URLs. GA4 will collect campaign attribution automatically, and the custom project/contact
events can then be analysed by campaign.

Example structure (replace values with the source you actually use):

`https://albertqueralto.dev/?utm_source=linkedin&utm_medium=profile&utm_campaign=job_search`

Do not put personal names, email addresses, company-confidential information, or other PII
inside UTM parameters.
