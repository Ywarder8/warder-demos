# Presenting the AI receptionist demo

A 3-minute walkthrough that shows every feature. Works best on a phone, or a laptop with
the browser window narrowed. Turn the volume up so the client hears Ava's voice.

## Before the meeting

- Open the demo once and tap Call, so the browser has already loaded its voices and asked
  for the microphone (if you plan to talk instead of type).
- Check `CONFIG` has the client's real phone number, hours and service-area towns.
- Chrome, Edge or Safari for voice input. Firefox works but without the mic.

## The script

1. **The normal call (about 60 seconds).** Leave the toggle on Office hours and tap Call.
   Say or type *"A tree came down in the storm."* Ava skips straight past "what happened".
   Tap **House**, then **No one is hurt**, give a name, *"45 King St"* (no town), and Ava
   asks which town. Answer **London**, give a number, tap **No, just me**, then confirm.
   Point out the text message the crew receives.

2. **The emergency (about 45 seconds).** Start over and say *"A tree fell on the power lines
   and my husband is hurt."* The red URGENT banner appears immediately, Ava tells the caller
   the crew is being notified and to stay clear, Power lines is already ticked, and she
   never asks whether anyone is hurt because the caller already said so.

3. **The guardrails (about 30 seconds).** At any question, ask *"How much is this going to
   cost?"*, *"When can you get here?"* or *"Am I talking to a real person?"* Ava doesn't
   quote prices or times, says she's an AI, then goes straight back to her question.

4. **Fixing a mistake.** At the read-back, say *"No, the address is wrong."* Ava jumps
   straight to the address and reads everything back again.

5. **After hours.** Back on the intro screen, switch to After hours. The greeting changes
   and the crew's text is labelled after hours.

## Questions clients ask

- **"Is this the real thing?"** It's a scripted demo of the call flow and the summary the
  crew gets. The production version answers real calls on the business's number.
- **"Can she say no to jobs outside our area?"** She never turns callers away; she flags the
  address so the crew decides. That's a setting.
- **"Can we change what she asks?"** Yes. The questions, wording, urgent rules and name are
  all in one settings block.
