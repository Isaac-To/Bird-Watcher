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
import json

url_signer = URLSigner(session)


# Return a db query that includes only the given partial name or species
def species_search_filter(nameSearch, nameList):
    if nameList:
        return db.sighting.common_name.belongs(nameList.split(","))
    elif nameSearch:
        return db.sighting.common_name.contains(nameSearch, case_sensitive=False)
    else:
        return True


# Parse [min_lon, min_lat, max_lon, max_lat] from a string
def parse_bounds(bounds):
    try:
        l = [float(x) for x in bounds.split(",")]
        return l if len(l) == 4 else None
    except:
        return None


@action("default")
@action.uses(db, auth)
def default():
    return redirect(URL("index"))


@action("index")
@action.uses("index.html", db, auth, url_signer)
def index():
    names = [row.name for row in db(db.species).select(db.species.name, orderby=db.species.name)]
    return dict(speciesList=json.dumps(names))


@action("location")
@action.uses("location.html", db, auth, url_signer)
def index():
    return dict(
        species_url=URL("api/species_by_region", signer=url_signer),
        trends_url=URL("api/species_trends", signer=url_signer),
        contributors_url=URL("api/top_contributors", signer=url_signer),
    )


@action("api/species_by_region")
@action.uses(db, auth.user)
def species_by_region():
    bounds = parse_bounds(request.params.get("bounds"))
    if not bounds:
        return dict(error="Missing or invalid bounds")

    total_count = db.sighting.count.sum()
    species_data = db(
        (db.sighting.event_id == db.checklist.event_id)
        & (db.checklist.longitude > bounds[0])
        & (db.checklist.latitude > bounds[1])
        & (db.checklist.longitude < bounds[2])
        & (db.checklist.latitude < bounds[3])
    ).select(db.sighting.common_name, total_count, groupby=db.sighting.common_name)

    # Format the result as an array of objects
    formatted_data = [
        {"common_name": row.sighting.common_name, "total_count": row[total_count]}
        for row in species_data
    ]
    return dict(data=formatted_data)


@action("api/species_trends")
@action.uses(db, auth.user)
def species_trends():
    species_name = request.params.get("species_name")
    if not species_name:
        return dict(error="Missing species_name")

    bounds = parse_bounds(request.params.get("bounds"))
    if not bounds:
        return dict(error="Missing or invalid bounds")

    try:
        total_count = db.sighting.count.sum()
        trends = db(
            (db.sighting.event_id == db.checklist.event_id)
            & (db.sighting.common_name == species_name)
            & (db.checklist.longitude > bounds[0])
            & (db.checklist.latitude > bounds[1])
            & (db.checklist.longitude < bounds[2])
            & (db.checklist.latitude < bounds[3])
        ).select(
            db.checklist.date,
            total_count,
            groupby=db.checklist.date,
            orderby=db.checklist.date,
        )

        formatted_trends = [
            {"date": row.checklist.date, "total_count": row[total_count]}
            for row in trends
        ]
        return dict(data=formatted_trends)
    except Exception as e:
        logger.error(f"Error querying trends: {e}")
        return dict(error="An error occurred while retrieving trends.")


@action("api/top_contributors")
@action.uses(db, auth.user)
def top_contributors():
    bounds = parse_bounds(request.params.get("bounds"))
    if not bounds:
        return dict(error="Missing or invalid bounds")

    checklist_count = db.checklist.id.count()
    contributors = db(
        (db.checklist.longitude > bounds[0])
        & (db.checklist.latitude > bounds[1])
        & (db.checklist.longitude < bounds[2])
        & (db.checklist.latitude < bounds[3])
    ).select(
        db.checklist.observer_id,
        checklist_count,
        groupby=db.checklist.observer_id,
        orderby=~checklist_count,
        limitby=(0, 5),
    )

    # Format the result as an array of objects
    formatted_contributors = [
        {
            "observer_id": row.checklist.observer_id,
            "checklist_count": row[checklist_count],
        }
        for row in contributors
    ]
    return dict(data=formatted_contributors)


@action("statistics")
@action.uses("statistics.html", db, auth, url_signer)
def statistics():
    if not auth.current_user:
        redirect(URL("index"))
    # Get list of all sightings by the user
    events = (
        db(db.checklist.observer_id == auth.current_user.get("id"))
        .select()
        .sort(lambda row: row.date)
        .as_list()
    )

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

    # Species Seen, When, Where
    speciesSeen = {}
    for event in events:
        event_id = event["event_id"]
        date = event["date"].date()
        if searchTerm != "":
            species = (
                db(
                    (db.sighting.event_id == event_id)
                    & (db.sighting.common_name.contains(searchTerm))
                )
                .select()
                .first()
            )
        else:
            species = db(db.sighting.event_id == event_id).select().first()
        if species == None:
            continue
        if species.common_name not in speciesSeen:
            speciesSeen[species.common_name] = []
        speciesSeen[species.common_name].append(
            (date, (event["latitude"], event["longitude"]))
        )

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


@action("api/sightings")
@action.uses(db)
def get_sightings():
    # Get filters
    filter = species_search_filter(
        request.query.get("search"), request.query.get("list")
    )

    # Get all sightings and their coordinates
    totalSightings = db.sighting.count.sum()
    rows = db((db.sighting.event_id == db.checklist.event_id) & filter).select(
        db.checklist.latitude,
        db.checklist.longitude,
        totalSightings,
        groupby=db.sighting.event_id,
        cache=(cache.get, 300),
        cacheable=True,
    )

    # Serve list of [lat, lng, count]
    result = [
        [row.checklist.latitude, row.checklist.longitude, row[totalSightings]]
        for row in rows
    ]
    return dict(sightings=result)
