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

import time
from py4web import action, request, abort, redirect, URL
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
from .models import get_user_email
from statistics import median

url_signer = URLSigner(session)


@action("index")
@action.uses("index.html", db, auth, url_signer)
def index():
    names = map(
        lambda row: row.name,
        db(db.species).select(db.species.name, orderby=db.species.name),
    )
    return dict(
        speciesList='["' + '","'.join(names) + '"]',
        # my_callback_url = URL('my_callback', signer=url_signer),
    )


@action("sightings")
@action.uses(db)
def get_sightings():
    # Get filters
    filterString = request.query.get("s", "").upper()
    filterList = request.query.get("l")
    if filterList != None:
        filterList = filterList.split(",")

    def filterIncludes(species):
        return filterString in species.upper() and (
            filterList == None or species in filterList
        )

    # Get all sightings and their coordinates
    # Cache the result to speed up subsequent searches
    rows = db(
        (db.sighting.event_id == db.checklist.event_id)
        & filterIncludes(db.sighting.common_name)
    ).select(
        db.checklist.latitude,
        db.checklist.longitude,
        db.sighting.count,
        db.sighting.common_name,
        cache = (cache.get, 300),
        cacheable = True
    )

    # Sum all sighting counts at each coord
    totalSightings = {}
    for row in rows:
        if filterIncludes(row.sighting.common_name):
            latlng = (
                round(row.checklist.latitude, 5),
                round(row.checklist.longitude, 5),
            )
            totalSightings[latlng] = totalSightings.get(latlng, 0) + row.sighting.count


    # Serve list of [lat, lng, count]
    result = map(lambda pair: [pair[0][0], pair[0][1], pair[1]], totalSightings.items())
    return dict(sightings=result)
