# 1.3 Marking a lesson done

At the bottom of every lesson page there is one checkbox, **Done**. Tick it when you have worked through the page. That is the whole progress model: no streaks, no points, no timers.

What the mark feeds:

* the progress bar of the handbook on the Handbooks page and on its cards;
* the **Today** page, whose first block takes you back to the last page you visited, with the handbook's progress beside it;
* the week review, which counts the days on which you marked a lesson done.

Where the mark is stored depends on how the app was built. With the web app alone it lives in the browser (`localStorage`), so it is per device. With the Django backend it is saved through the progress API and follows you to any browser you sign in from. The Today page offers once to move old browser marks to the server.

{% hint style="warning" %}
A visit alone is not progress. Opening a page records it as "last visited", so Today can bring you back, but the handbook only moves forward when you tick the box.
{% endhint %}
