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
from statistics import median

url_signer = URLSigner(session)

@action('default')
@action.uses(db, auth)
def default():
    return redirect(URL('index'))

@action("index")
@action.uses("index.html", db, auth, url_signer)
def index():
    names = map(
          lambda row: row.name,
          db(db.species).select(db.species.name, orderby=db.species.name),
    )
    return dict(speciesList='["' + '","'.join(names) + '"]')

@action('location')
@action.uses('location.html', db, auth, url_signer)
def index():
    return dict(
        species_url=URL('api/species_by_region', signer=url_signer),
        trends_url=URL('api/species_trends', signer=url_signer),
        contributors_url=URL('api/top_contributors', signer=url_signer),
        check_login_url=URL('api/check_login', signer=url_signer),
    )

@action('api/species_by_region')
@action.uses(db, auth.user)
def species_by_region():
    latitude = request.params.get('latitude')
    longitude = request.params.get('longitude')

    if not latitude or not longitude:
        return dict(error="Latitude and longitude are required")

    try:
        latitude = float(latitude)
        longitude = float(longitude)
    except ValueError:
        return dict(error="Invalid latitude or longitude format")

    species_data = db.executesql("""
        SELECT s.common_name, SUM(s.count) AS total_count
        FROM sighting s
        JOIN checklist c ON s.event_id = c.event_id
        WHERE c.latitude BETWEEN ? AND ?
          AND c.longitude BETWEEN ? AND ?
        GROUP BY s.common_name
        """, [latitude - 0.1, latitude + 0.1, longitude - 0.1, longitude + 0.1])

    # Format the result as an array of objects
    formatted_data = [{"common_name": row[0], "total_count": row[1]} for row in species_data]
    return dict(data=formatted_data)

@action('api/species_trends')
@action.uses(db, auth.user)
def species_trends():
    species_name = request.params.get('species_name')
    latitude = request.params.get('latitude')
    longitude = request.params.get('longitude')

    if not species_name or not latitude or not longitude:
        return dict(error="Missing parameters")

    try:
        latitude = float(latitude)
        longitude = float(longitude)
    except ValueError:
        return dict(error="Invalid latitude or longitude format")

    try:
        logger.info(f"Fetching trends for {species_name} at ({latitude}, {longitude})")
        trends = db.executesql("""
            SELECT c.date, SUM(s.count) AS total_count
            FROM sighting s
            JOIN checklist c ON s.event_id = c.event_id
            WHERE s.common_name = ?
              AND c.latitude BETWEEN ? AND ?
              AND c.longitude BETWEEN ? AND ?
            GROUP BY c.date
            ORDER BY c.date
            """, [species_name, latitude - 0.1, latitude + 0.1, longitude - 0.1, longitude + 0.1])

        formatted_trends = [{"date": row[0], "total_count": row[1]} for row in trends]
        return dict(data=formatted_trends)
    except Exception as e:
        logger.error(f"Error querying trends: {e}")
        return dict(error="An error occurred while retrieving trends.")

@action('api/top_contributors')
@action.uses(db, auth.user)
def top_contributors():
    latitude = request.params.get('latitude')
    longitude = request.params.get('longitude')

    if not latitude or not longitude:
        return dict(error="Latitude and longitude are required")

    try:
        latitude = float(latitude)
        longitude = float(longitude)
    except ValueError:
        return dict(error="Invalid latitude or longitude format")

    contributors = db.executesql("""
        SELECT c.observer_id, COUNT(c.event_id) AS checklist_count
        FROM checklist c
        WHERE c.latitude BETWEEN ? AND ?
          AND c.longitude BETWEEN ? AND ?
        GROUP BY c.observer_id
        ORDER BY checklist_count DESC
        LIMIT 5
        """, [latitude - 0.1, latitude + 0.1, longitude - 0.1, longitude + 0.1])

    # Format the result as an array of objects
    formatted_contributors = [{"observer_id": row[0], "checklist_count": row[1]} for row in contributors]
    return dict(data=formatted_contributors)

@action('api/check_login')
@action.uses(auth)
def check_login():
    logger.info("check_login endpoint accessed")
    user_email = get_user_email()
    return dict(logged_in=user_email is not None)

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

    # Species Seen, When, Where
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
        speciesSeen[species.common_name].append((date, (event["latitude"], event["longitude"])))

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

@action("sightings")
@action.uses(db)
def get_sightings():
    # Get filters
    filterString = request.query.get("s", "").upper()
    filterList = request.query.get("l")
    if filterList != None:
        filterList = filterList.split(",")

    filter = True
    if filterString:
        filter &= db.sighting.common_name.contains(filterString, case_sensitive=False)
    if filterList:
        filter &= db.sighting.common_name.belongs(filterList)

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
    result = map(
        lambda row: [
            row.checklist.latitude,
            row.checklist.longitude,
            row[totalSightings],
        ],
        rows,
    )
    return dict(sightings=result)
