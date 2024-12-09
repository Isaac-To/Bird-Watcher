"""
This file defines actions, i.e. functions the URLs are mapped into
The @action(path) decorator exposed the function at URL:

    http://127.0.0.1:8000/{app_name}/{path}

If app_name == '_default' then simply

    http://127.0.0.1:8000/{path}

If path == 'index' it can be omitted:

    http://127.0.0.1:8000/

The path follows the bottlepy syntax.

@action.uses('generic.html')  indicates that the action uses the generic.html template
@action.uses(session)         indicates that the action uses the session
@action.uses(db)              indicates that the action uses the db
@action.uses(T)               indicates that the action uses the i18n & pluralization
@action.uses(auth.user)       indicates that the action requires a logged in user
@action.uses(auth)            indicates that the action requires the auth object

session, db, T, auth, and tempates are examples of Fixtures.
Warning: Fixtures MUST be declared with @action.uses({fixtures}) else your app will result in undefined behavior
"""

from py4web import action, request, abort, redirect, URL, Field
from yatl.helpers import A
from .common import (
    db,
    session,
    T,
    cache,
    auth,
    logger,
    authenticated,
    unauthenticated,
    flash,
)
from py4web.utils.url_signer import URLSigner
from py4web.utils.form import Form, FormStyleBulma
from pydal.validators import *
from .models import get_user_email

url_signer = URLSigner(session)


@action("index")
@action.uses("index.html", db, auth, url_signer)
def index():
    return dict(
        # COMPLETE: return here any signed URLs you need.
        my_callback_url=URL("my_callback", signer=url_signer),
    )


@action("statistics")
@action.uses("statistics.html", db, auth, url_signer)
def statistics():
    if not auth.current_user:
        redirect(URL("index"))
    # Get list of all sightings by the user
    events = db(
        db.checklist.observer_id == auth.current_user.get("id")
    ).select().sort(lambda row: row.date).as_list()

    # Sightings by day
    sightingsByDay = {}
    for event in events:
        date = event["date"].date()
        if date not in sightingsByDay:
            sightingsByDay[date] = 0
        sightingsByDay[date] += 1

    searchForm = Form(
        [
            Field("Search", "string", requires=IS_NOT_EMPTY()),
        ],
        formstyle=FormStyleBulma,
    )

    searchTerm = ""
    if searchForm.accepted:
        searchTerm = searchForm.vars.get("Search")

    # Species Seen and When
    speciesSeen = {}
    for event in events:
        event_id = event["event_id"]
        date = event["date"].date()
        if searchTerm != "":
            species = db(
                (db.sighting.event_id == event_id) &
                (db.sighting.common_name.contains(searchTerm))
            ).select().first()
        else:
            species = db(
                db.sighting.event_id == event_id
            ).select().first()
        if species == None:
            continue
        if species.common_name not in speciesSeen:
            speciesSeen[species.common_name] = []
        speciesSeen[species.common_name].append(date)

    # Time spent bird watching by day
    timeByDay = {}
    for event in events:
        date = event["date"].date()
        if date not in timeByDay:
            timeByDay[date] = 0
        timeByDay[date] += event["duration_minutes"]

    return dict(
        # COMPLETE: return here any signed URLs you need.
        sightingsByDay=sightingsByDay,
        timeByDay=timeByDay,
        speciesSeen=speciesSeen,
        searchForm=searchForm,
        my_callback_url=URL("my_callback", signer=url_signer),
    )


@action("my_callback")
@action.uses()  # Add here things like db, auth, etc.
def my_callback():
    # The return value should be a dictionary that will be sent as JSON.
    return dict(my_value=3)
