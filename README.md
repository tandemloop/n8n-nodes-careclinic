# n8n-nodes-careclinic

This is an n8n community node for CareClinic Health Tracker.

CareClinic is a health tracker built for people managing chronic conditions and long-term illness. Track symptoms, medications and supplements, mood, sleep, pain, vitals and daily habits in one place, and import data from wearables, health apps and patient portals so nothing gets left out. Reports and insights show how your symptoms change over time and what tends to come before a flare, so you arrive at every appointment with a clear, shareable record instead of trying to remember. With CareClinic connected to the apps you already use, staying on track takes less effort: never miss a dose, capture a symptom the moment it happens, and keep the people who support you in the loop. CareClinic does not provide medical advice, diagnose conditions, recommend treatment, or provide emergency care.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation) · [Operations](#operations) · [Credentials](#credentials) · [Usage](#usage) · [Compatibility](#compatibility) · [Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation and install `n8n-nodes-careclinic`.

## Operations

| Resource | Operation | API call |
|---|---|---|
| Account | Get the connected account | `GET /v1/me` |
| Catalog | Search your symptoms, medications or sleep care plans | `GET /v1/catalog/search` |
| Entry | Create a symptom, mood or medication entry | `POST /v1/entries` |
| Entry | Get entries logged since a time (symptom, mood, medication and sleep) | `GET /v1/entries?since=` |
| Reminder | Get today's medication schedule | `GET /v1/reminders/today` |
| Wellness | Get recent symptoms, moods, medications and sleep (1 to 90 days) | `GET /v1/wellness` |

The full API description is at [api.careclinic.io/v1/openapi.json](https://api.careclinic.io/v1/openapi.json).

## Credentials

The node signs in with OAuth2 through CareClinic (authorize URL `https://api.careclinic.io/oauth/authorize`, token URL `https://api.careclinic.io/oauth/token`).

1. In n8n, create a **CareClinic OAuth2 API** credential.
2. Enter the Client ID and Client Secret for your n8n instance. To get them, contact CareClinic through [careclinic.io/contact-us](https://careclinic.io/contact-us/) and include the OAuth Redirect URL shown in the credential. n8n Cloud uses `https://oauth.n8n.cloud/oauth2/callback`.
3. Select **Connect my account**, sign in to CareClinic and approve access.

The credential requests `careclinic.wellness.read`, `careclinic.symptoms.write`, `careclinic.mood.write` and `careclinic.medications.write`. A connection lasts 30 days from approval. After that, reconnect the credential.

## Usage

* **Log a symptom:** run **Catalog > Search** with domain `symptom`, then **Entry > Create** with domain `symptom`, the returned `id` as Symptom ID and the returned `name` as Symptom Name.
* **Log a dose:** run **Reminder > Get Today**, then **Entry > Create** with domain `medication`, using `medicationId`, `medicationName`, `reminderId`, `reminderIndex` and `scheduledAt` (as Occurred At) from the chosen dose.
* **React to new entries:** schedule **Entry > Get Many** with a Since time, for example the last run time.

Create requests send an `Idempotency-Key` header scoped to the workflow, node, execution, invocation and item. The automatic key and timestamp stay stable on retries. To override the key, add **Idempotency Key** under **Entry > Create > Additional Fields**. Existing workflows keep saved keys until a key is added there. An explicitly empty key omits the header.

## Compatibility

Built with `@n8n/node-cli` and tested with n8n 1.x.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [CareClinic API description (OpenAPI)](https://api.careclinic.io/v1/openapi.json)
* [CareClinic](https://careclinic.io)
